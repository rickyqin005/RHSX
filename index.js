const process = {
    'env': {
        'DISPLAY_BOARD_CHANNEL_ID': '994989436741877840',
        'DISPLAY_BOARD_MESSAGE_ID': '996076376715178004',
        'BOT_SPAM_CHANNEL_ID': '991864163926282300',
        'BOT_ID': '991856515122212905',
        'BOT_TOKEN': 'OTkxODU2NTE1MTIyMjEyOTA1.G9KHQy.imJHMz78esmKBamF-VJOTwZLtoDrp2FrTR5Ji0',
        'MONGO_URI': 'mongodb+srv://rhsx-bot:LvjhOyqd3nHql0yV@rhsx.w4kgku2.mongodb.net/?retryWrites=true&w=majority&useNewUrlParser=true&useUnifiedTopology=true'
    }
};
// Discord
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('this is a bot'));
app.listen(port, () => console.log(`listening at port ${port}`));
const { Client, Intents } = require('discord.js');
const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES] });

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

class Trader {
    static DEFAULT_POSITION_LIMIT = 100000;

    static getTraders() {
        return mongoClient.db('RHSX').collection('Traders');
    }
    static async getTrader(_id) {
        let res = await this.getTraders().findOne({ _id: _id });
        if(res != null) res = new Trader(res);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.positionLimit = args.positionLimit;
        this.positions = args.positions;
    }

    async toString() {
        let str = '';
        str += 'Positions:\n';
        str += '```';
        str += `${setW('Ticker', 10)}${setW('Quantity', 10)}${setW('Open PnL', 10)}\n`;
        for(const pos in this.positions) {
            let position = this.positions[pos];
            if(position.quantity != 0) str += `${setW(position.ticker, 10)}${setW(position.quantity, 10)}${setW(pricef(await this.calculateOpenPnL(position)), 10)}\n`;
        }
        str += '```\n';
        str += 'Pending Orders:\n';
        str += '```';
        let pendingOrders = await Order.queryOrders({
            user: this._id,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { timestamp: -1 });
        pendingOrders.forEach(order => str += `${order.toDetailedInfoString()}\n`);
        if(pendingOrders.length == 0) str += ' ';
        str += '```';
        return str;
    }

    async addPosition(position) {
        if(this.positions[position.ticker] == undefined) {
            this.positions[position.ticker] = position;
            await Trader.getTraders().updateOne({ _id: this._id }, { $set: { [`positions.${position.ticker}`]: position }});
        } else {
            this.positions[position.ticker].quantity += position.quantity;
            this.positions[position.ticker].costBasis += position.costBasis;
            await Trader.getTraders().updateOne({ _id: this._id }, { $inc: { [`positions.${position.ticker}.quantity`]: position.quantity, [`positions.${position.ticker}.costBasis`]: position.costBasis } });
        }
    }

    async calculateOpenPnL(position) {
        return (await orderBook.getLastTradedPrice(position.ticker))*position.quantity - position.costBasis;
    }
}

class Order {
    static LIMIT_ORDER_TYPE = 'LIMIT';
    static LIMIT_ORDER_LABEL = 'limit order';
    static MARKET_ORDER_TYPE = 'MARKET';
    static MARKET_ORDER_LABEL = 'market order';
    static STOP_ORDER_TYPE = 'STOP';
    static STOP_ORDER_LABEL = 'stop order';
    static BUY = 'BUY';
    static SELL = 'SELL';
    static CANCELLED = -1;
    static UNSUBMITTED = 0;
    static IN_QUEUE = 1;
    static NOT_FILLED = 2;
    static PARTIALLY_FILLED = 3;
    static COMPLETELY_FILLED = 4;
    static UNFULFILLABLE = 0;
    static VIOLATES_POSITION_LIMITS = 1;

    static getOrders() {
        return mongoClient.db('RHSX').collection('Orders');
    }
    static async getOrder(_id) {
        let res = await this.getOrders().findOne({ _id: _id });
        if(res != null) res = new Order(res);
        return res;
    }
    static async queryOrder(query) {
        let res = await this.getOrders().findOne(query);
        if(res != null) res = new Order(res);
        return res;
    }
    static async queryOrders(query, sort) {
        let res = await this.getOrders().find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = new Order(res[i]);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.type = args.type;
        this.timestamp = args.timestamp;
        this.user = args.user;
        this.direction = args.direction;
        this.ticker = args.ticker;
        this.status = args.status;

        if(this.type == Order.LIMIT_ORDER_TYPE || this.type == Order.MARKET_ORDER_TYPE) {
            this.quantity = args.quantity;
            this.quantityFilled = args.quantityFilled;
            this.netPositionChangeSign = ((this.direction == Order.BUY) ? 1 : -1);

            this.toStopString = function () {
                if(this.type == Order.LIMIT_ORDER_TYPE) {
                    return `${this.direction} ${this.type} x${this.quantity} @${pricef(this.price)}`;
                } else if(this.type == Order.MARKET_ORDER_TYPE) {
                    return `${this.direction} ${this.type} x${this.quantity}`;
                }
            }

            this.getQuantityUnfilled = function () {
                return this.quantity - this.quantityFilled;
            }

            this.increaseQuantityFilled = async function (amount, price) {
                this.quantityFilled += amount;
                await Order.getOrders().updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } });

                if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED);
                else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED);
                else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED);
                let position = { ticker: this.ticker, quantity: amount*this.netPositionChangeSign, costBasis: amount*this.netPositionChangeSign*price };
                await (await Trader.getTrader(this.user)).addPosition(position);
            }

            if(this.type == Order.LIMIT_ORDER_TYPE) {
                this.label = Order.LIMIT_ORDER_LABEL;
                this.price = args.price;
            } else if(this.type == Order.MARKET_ORDER_TYPE) {
                this.label = Order.MARKET_ORDER_LABEL;
            }
        } else if(this.type == Order.STOP_ORDER_TYPE) {
            this.label = Order.STOP_ORDER_LABEL;
            this.triggerPrice = args.triggerPrice;
            this.executedOrder = new Order(args.executedOrder);
        }
    }

    toDisplayBoardString() {
        if(this.type == Order.LIMIT_ORDER_TYPE) {
            return `@${pricef(this.price)} x${this.getQuantityUnfilled()}`;
        } else if(this.type == Order.MARKET_ORDER_TYPE) {
            return `x${this.quantity}`;
        } else if(this.type == Order.STOP_ORDER_TYPE) {
            return `@${pricef(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
        }
    }

    toInfoString() {
        if(this.type == Order.LIMIT_ORDER_TYPE) {
            return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker} @${pricef(this.price)}`;
        } else if(this.type == Order.MARKET_ORDER_TYPE) {
            return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker}`;
        } else if(this.type == Order.STOP_ORDER_TYPE) {
            return `#${this._id}, ${this.executedOrder.ticker} @${pricef(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
        }
    }

    toDetailedInfoString() {
        if(this.type == Order.LIMIT_ORDER_TYPE) {
            return `#${this._id}, ${this.direction} x${this.quantity} (x${this.quantityFilled} filled) ${this.ticker} @${pricef(this.price)}, submitted ${dateStr(this.timestamp)}`;
        } else if(this.type == Order.MARKET_ORDER_TYPE) {
            return `#${this._id}, ${this.direction} x${this.quantity} (x${this.quantityFilled} filled) ${this.ticker}, submitted ${dateStr(this.timestamp)}`;
        } else if(this.type == Order.STOP_ORDER_TYPE) {
            return `#${this._id}, ${this.executedOrder.ticker} @${pricef(this.triggerPrice)}, ${this.executedOrder.toStopString()}, submitted ${dateStr(this.timestamp)}`;
        }
    }

    orderSubmittedString() {
        return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is submitted.`;
    }

    orderFilledString() {
        if(this.type == Order.LIMIT_ORDER_TYPE || this.type == Order.MARKET_ORDER_TYPE) {
            return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is filled.`;
        } else if(this.type == Order.STOP_ORDER_TYPE) {
            return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is triggered.`;
        }
    }

    orderCancelledString(reason) {
        switch(reason) {
            case Order.UNFULFILLABLE:
                return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `${pingStr(this.user)} Your ${this.label}: \`${this.toInfoString()}\` is cancelled.`;
        }
    }

    async setStatus(newStatus, reason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status.');
        if(newStatus == this.status) return;

        this.status = newStatus;
        await Order.getOrders().updateOne({ _id: this._id }, { $set: { status: newStatus } });

        if(newStatus == Order.NOT_FILLED) messageQueue.add(this.orderSubmittedString(), messageQueue.SEND);
        else if(newStatus == Order.COMPLETELY_FILLED) messageQueue.add(this.orderFilledString(), messageQueue.SEND);
        else if(newStatus == Order.CANCELLED) messageQueue.add(this.orderCancelledString(reason), messageQueue.SEND);
    }
}

class Ticker {
    static getTickers() {
        return mongoClient.db('RHSX').collection('Tickers');
    }
    static async getTicker(_id) {
        let res = await this.getTickers().findOne({ _id: _id });
        if(res != null) res = new Ticker(res);
        return res;
    }
    static async queryTickers(query, sort) {
        let res = await this.getTickers().find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = new Ticker(res[i]);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.lastTradedPrice = args.lastTradedPrice;
        this.volume = args.volume;
    }
}

const orderBook = new class {
    displayBoardMessage;
    startUpTime;

    async initialize() {
        let channel = await discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
        this.displayBoardMessage = await channel.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        await this.#updateDisplayBoard();
        setInterval(async () => await this.#updateDisplayBoard(), 60000);
        this.startUpTime = new Date();
    }

    async #updateDisplayBoard() {
        messageQueue.add(await this.#toDisplayBoardString(), messageQueue.EDIT, this.displayBoardMessage);
    }

    async #toDisplayBoardString() {
        let str = '';
        str += `Last updated at ${dateStr(new Date())}\n`;
        str += '```\n';
        str += setW('Ticker', 10) + setW('Price', 10) + setW('Bid', 10) + setW('Ask', 10) + setW('Volume', 10) + '\n';
        let tickers = await Ticker.queryTickers({});
        for(const ticker of tickers) {
            let topBid = (await this.getBids(ticker._id))[0];
            if(topBid != undefined) topBid = topBid.price;
            let topAsk = (await this.getAsks(ticker._id))[0];
            if(topAsk != undefined) topAsk = topAsk.price;
            str += setW(ticker._id, 10) + setW(pricef(ticker.lastTradedPrice), 10) +
            setW(pricef(topBid), 10) + setW(pricef(topAsk), 10) + setW(ticker.volume, 10) + '\n';
        }
        str += '```\n';

        for(const ticker of tickers) {
            str += `Ticker: ${ticker._id}\n`;
            str += '```\n';
            str += setW('Bids', 20) + 'Asks' + '\n';
            let bids = await this.getBids(ticker._id);
            let asks = await this.getAsks(ticker._id);
            for(let i = 0; i < Math.max(bids.length, asks.length); i++) {
                if(i < bids.length) str += setW(bids[i].toDisplayBoardString(), 20);
                else str += setW('', 20);
                if(i < asks.length) str += asks[i].toDisplayBoardString();
                str += '\n';
            }
            str += '```\n';
        }
        return str;
    }

    async getBids(_id) {
        const ticker = await Ticker.getTicker(_id);
        return await Order.queryOrders({
            direction: Order.BUY,
            ticker: ticker._id,
            type: Order.LIMIT_ORDER_TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: -1, timestamp: 1 });
    }

    async getAsks(_id) {
        const ticker = await Ticker.getTicker(_id);
        return await Order.queryOrders({
            direction: Order.SELL,
            ticker: ticker._id,
            type: Order.LIMIT_ORDER_TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: 1, timestamp: 1 });
    }

    async #matchOrder(newOrder, existingOrder) {
        const quantity = Math.min(newOrder.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        const price = existingOrder.price;
        await existingOrder.increaseQuantityFilled(quantity, price);
        await newOrder.increaseQuantityFilled(quantity, price);
        await Ticker.getTickers().updateOne({ _id: existingOrder.ticker }, { $inc: { volume: quantity } });
        return { quantity: quantity, price: price };
    }

    async submitRawOrder(user, direction, args) {
        let order = {};
        Object.assign(order, { type: args[1], timestamp: new Date(), user: user, direction: direction, ticker: args[2], status: Order.UNSUBMITTED });
        if((await Ticker.getTicker(order.ticker)) == null) throw new Error('Invalid ticker.');
        if(order.type == Order.LIMIT_ORDER_TYPE || order.type == Order.MARKET_ORDER_TYPE) {
            Object.assign(order, { quantity: parseInt(args[3]), quantityFilled: 0 });
            if(Number.isNaN(order.quantity) || !(1 <= order.quantity)) throw new Error('Quantity must be greater than 0.');
            if(order.type == Order.LIMIT_ORDER_TYPE) {
                Object.assign(order, { price: toPrice(args[4]) });
                if(Number.isNaN(order.price)) throw new Error('Invalid limit price.');
            } else if(order.type == Order.MARKET_ORDER_TYPE);
        } else if(order.type == Order.STOP_ORDER_TYPE) {
            order.triggerPrice = toPrice(args[3]);
            if(Number.isNaN(order.triggerPrice)) throw new Error('Invalid trigger price.');
            let executedOrder = { type: args[4], timestamp: new Date(), user: user, direction: direction, ticker: args[2], status: Order.UNSUBMITTED, quantity: parseInt(args[5]), quantityFilled: 0 };
            if(Number.isNaN(executedOrder.quantity) || !(1 <= executedOrder.quantity)) throw new Error('Quantity must be a positive integer.');
            if(direction == Order.BUY && !((await this.getLastTradedPrice(order.ticker)) < order.triggerPrice)) throw new Error('Trigger price must be greater than current price.');
            if(direction == Order.SELL && !(order.triggerPrice < (await this.getLastTradedPrice(order.ticker)))) throw new Error('Trigger price must be less than current price.');
            if(executedOrder.type == Order.LIMIT_ORDER_TYPE) {
                executedOrder.price = toPrice(args[6]);
                if(Number.isNaN(executedOrder.price)) throw new Error('Invalid limit price.');
            } else if(executedOrder.type == Order.MARKET_ORDER_TYPE);
            else throw new Error(`Triggered order type must be one of \`${Order.LIMIT_ORDER_TYPE}\` or \`${Order.MARKET_ORDER_TYPE}\`.`);
            order.executedOrder = executedOrder;
        } else throw new Error(`Order type must be one of \`${Order.LIMIT_ORDER_TYPE}\`, \`${Order.MARKET_ORDER_TYPE}\` or \`${Order.STOP_ORDER_TYPE}\`.`);
        await this.#submitOrder(order);
    }

    async #submitOrder(order) {
        order.timestamp = new Date();
        let dbResponse = await Order.getOrders().insertOne(order);
        order = await Order.getOrder(dbResponse.insertedId);
        console.log(order);
        // await order.setStatus(Order.IN_QUEUE);
        await order.setStatus(Order.NOT_FILLED);
        if(order.type == Order.LIMIT_ORDER_TYPE) await this.#submitLimitOrder(order);
        else if(order.type == Order.MARKET_ORDER_TYPE) await this.#submitMarketOrder(order);
        else if(order.type == Order.STOP_ORDER_TYPE);
        await this.#updateDisplayBoard();
    }

    async #submitLimitOrder(order) {
        let newLastTradedPrice = await this.getLastTradedPrice(order.ticker);
        if(order.direction == Order.BUY) {
            const asks = await this.getAsks(order.ticker);
            for(const bestAsk of asks) {
                if(order.status == Order.COMPLETELY_FILLED || order.price < bestAsk.price) break;
                newLastTradedPrice = (await this.#matchOrder(order, bestAsk)).price;
            }
        } else if(order.direction == Order.SELL) {
            const bids = await this.getBids(order.ticker);
            for(const bestBid of bids) {
                if(order.status == Order.COMPLETELY_FILLED || bestBid.price < order.price) break;
                newLastTradedPrice = (await this.#matchOrder(order, bestBid)).price;
            }
        }
        await this.#setLastTradedPrice(order.ticker, newLastTradedPrice);
    }

    async #submitMarketOrder(order) {
        let newLastTradedPrice = await this.getLastTradedPrice(order.ticker);
        if(order.direction == Order.BUY) {
            const asks = await this.getAsks(order.ticker);
            let asksDepth = 0;
            asks.forEach(ask => asksDepth += ask.getQuantityUnfilled());
            if(order.quantity > asksDepth) {
                await this.cancelOrder(order.user, order._id, Order.UNFULFILLABLE); return;
            }
            for(const bestAsk of asks) {
                if(order.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = (await this.#matchOrder(order, bestAsk)).price;
            }
        } else if(order.direction == Order.SELL) {
            const bids = await this.getBids(order.ticker);
            let bidsDepth = 0;
            bids.forEach(bid => bidsDepth += bid.getQuantityUnfilled());
            if(order.quantity > bidsDepth) {
                await this.cancelOrder(order.user, order._id, Order.UNFULFILLABLE); return;
            }
            for(const bestBid of bids) {
                if(order.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = (await this.#matchOrder(order, bestBid)).price;
            }
        }
        await this.#setLastTradedPrice(order.ticker, newLastTradedPrice);
    }

    async getLastTradedPrice(ticker) {
        return (await Ticker.getTicker(ticker)).lastTradedPrice;
    }

    async #setLastTradedPrice(ticker, newPrice) {
        let currPrice = await this.getLastTradedPrice(ticker);
        if(currPrice == newPrice) return;

        await Ticker.getTickers().updateOne({ _id: ticker }, { $set: { lastTradedPrice: newPrice } });
        let tickDirection = ((currPrice < newPrice) ? Order.BUY : Order.SELL);
        let triggeredStops = await Order.queryOrders({
            direction: tickDirection,
            ticker: ticker,
            type: Order.STOP_ORDER_TYPE,
            triggerPrice: { $gte: Math.min(currPrice, newPrice), $lte: Math.max(currPrice, newPrice) },
            status: Order.NOT_FILLED
        }, { timestamp: 1 });
        for(const stop of triggeredStops) {
            await stop.setStatus(Order.COMPLETELY_FILLED);
            await this.#submitOrder(stop.executedOrder);
        }
    }

    async cancelOrder(user, order, reason) {
        order = await Order.queryOrder({ _id: order, user: user });
        if(order == null) throw new Error('Invalid id.');
        if(order.status == Order.CANCELLED) throw new Error('Order is already cancelled.');
        if(order.status == Order.COMPLETELY_FILLED) throw new Error('Order is already filled.');
        await order.setStatus(Order.CANCELLED, reason);
        await this.#updateDisplayBoard();
    }
}();

const messageQueue = new class {
    SEND = 'send';
    EDIT = 'edit';
    #messages = [];
    #channel;

    async initialize() {
        this.#channel = await discordClient.channels.fetch(process.env['BOT_SPAM_CHANNEL_ID']);
        setInterval(() => this.#processNextMessage(), 1000);
    }

    add(string, type, messageObj) {
        if(type == messageQueue.SEND) this.#messages.push({ type: type, content: string });
        else this.#messages.push({ type: type, content: string, messageObj: messageObj });
    }

    #processNextMessage() {
        if(this.#messages.length > 0) {
            let item = this.#messages[0];
            if(item.type == messageQueue.SEND) this.#channel.send(item.content);
            else if(item.type == messageQueue.EDIT) item.messageObj.edit(item.content);
            this.#messages.splice(0, 1);
        }
    }
}();

discordClient.on('messageCreate', async msg => {
    if(msg.author == process.env['BOT_ID']) return;
    let args = msg.content.split(' ');
    try {
        switch(args[0]) {
            case '!help': {
                let infoString =
                    '```\n' +
                    `!help\n` +
                    `!bot\n` +
                    `!join\n` +
                    `!position\n` +
                    `!buy ${Order.LIMIT_ORDER_TYPE} [ticker] [quantity] [price]\n` +
                    `!sell ${Order.LIMIT_ORDER_TYPE} [ticker] [quantity] [price]\n` +
                    `!buy ${Order.MARKET_ORDER_TYPE} [ticker] [quantity]\n` +
                    `!sell ${Order.MARKET_ORDER_TYPE} [ticker] [quantity]\n` +
                    `!buy ${Order.STOP_ORDER_TYPE} [ticker] [trigger price] [order type] [quantity] [[price]]\n` +
                    `!sell ${Order.STOP_ORDER_TYPE} [ticker] [trigger price] [order type] [quantity] [[price]]\n` +
                    `!cancel [order id]\n` +
                    '```';
                messageQueue.add(infoString, messageQueue.SEND);
                break;
            }
            case '!bot': {
                messageQueue.add(`Active since ${dateStr(orderBook.startUpTime)}.`, messageQueue.SEND);
                break;
            }
            case '!join': {
                let trader = await Trader.getTrader(msg.author.id);
                if(trader == null) {
                    await Trader.getTraders().insertOne(new Trader({ _id: msg.author.id, positionLimit: Trader.DEFAULT_POSITION_LIMIT, positions: {} }));
                    messageQueue.add(`${msg.author} You're now a trader.`, messageQueue.SEND);
                } else {
                    messageQueue.add(`${msg.author} You're already a trader.`, messageQueue.SEND);
                }
                break;
            }
            case '!position': {
                let trader = await Trader.getTrader(msg.author.id);
                if(trader != null) messageQueue.add(await trader.toString(), messageQueue.SEND);
                break;
            }
            case '!buy': {
                let trader = await Trader.getTrader(msg.author.id);
                if(trader != null) await orderBook.submitRawOrder(msg.author.id, Order.BUY, args);
                break;
            }
            case '!sell': {
                let trader = await Trader.getTrader(msg.author.id);
                if(trader != null) await orderBook.submitRawOrder(msg.author.id, Order.SELL, args);
                break;
            }
            case '!cancel': {
                let trader = await Trader.getTrader(msg.author.id);
                if(trader != null) await orderBook.cancelOrder(msg.author.id, new ObjectId(args[1]));
                break;
            }
        }
    } catch(error) {
        messageQueue.add(error.message, messageQueue.SEND);
    }
});

discordClient.on('debug', console.log);

async function run() {
    await mongoClient.connect();
    console.log(`Connected to MongoDB!`);
    await discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord!`);
    await orderBook.initialize();
    await messageQueue.initialize();
}
run();

function pingStr(userId) {
    return `<@${userId}>`;
}
function setW(value, length) {
    value = String(value);
    return value + ' '.repeat(Math.max(length - value.length, 0));
}
function toPrice(price) {
    return parseInt(price*100);
}
function pricef(price) {
    if(price == null || price == undefined) return '-';
    price = price/100;
    if(Number.isNaN(price)) return '-';
    return price.toFixed(2);
}
function dateStr(date) {
    return date.toLocaleString('en-US', { timeZone: 'America/Toronto' });
}
