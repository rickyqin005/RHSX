require('dotenv').config();

// Discord
const { Client, Intents, MessageEmbed } = require('discord.js');
const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

class Trader {
    static DEFAULT_POSITION_LIMIT = 100000;
    static collection = mongoClient.db('RHSX').collection('Traders');

    static async getTrader(_id) {
        let res = await this.collection.findOne({ _id: _id }, current.mongoSession);
        if(res != null) res = new Trader(res);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.positionLimit = args.positionLimit;
        this.balance = args.balance;
        this.positions = {};
        for(const pos in args.positions) this.positions[pos] = new Position(args.positions[pos]);
    }

    async toString() {
        let accountValue = this.balance;
        for(const pos in this.positions) {
            accountValue += this.positions[pos].quantity*(await orderBook.getLastTradedPrice(pos));
        }
        let traderInfoEmbed = new MessageEmbed()
            .setTitle('Trader Info')
            .setColor('#3ba55d')
            .setAuthor({ name: (await discordClient.users.fetch(this._id)).tag })
            .addFields(
                { name: 'Account Value', value: Price.format(accountValue), inline: true },
                { name: 'Cash Balance', value: Price.format(this.balance), inline: true },
            );

        let positionsEmbed = new MessageEmbed()
        .setTitle('Positions')
        .setColor('#3ba55d')
        .addFields(
            { name: '\u200B', value: '**Symbol/Price**', inline: true },
            { name: '\u200B', value: '**Mkt Value/Quantity**', inline: true },
            { name: '\u200B', value: '**Open P&L**', inline: true },
        );
        for(const pos in this.positions) {
            let position = this.positions[pos];
            let price = await orderBook.getLastTradedPrice(pos);
            if(position.quantity == 0) continue;
            positionsEmbed.addFields(
                { name: position.ticker, value: Price.format(price), inline: true },
                { name: Price.format(price*position.quantity), value: position.quantity.toString(), inline: true },
                { name: Price.format(await this.calculateOpenPnL(position)), value: '\u200B', inline: true },
            );
        }

        let pendingOrdersEmbed = new MessageEmbed()
        .setTitle('Pending Orders')
        .setColor('#3ba55d');
        let pendingOrders = await this.getPendingOrders();
        pendingOrders.forEach(order => {
            const fields = order.toEmbedFields();
            pendingOrdersEmbed.addFields(fields[0], fields[1], fields[2]);
        });
        return { embeds: [traderInfoEmbed, positionsEmbed, pendingOrdersEmbed] };
    }

    async getPendingOrders(/*add optional parameter for order type*/) {
        return await Order.queryOrders({
            user: this._id,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { timestamp: -1 });
    }

    async addPosition(pos) {
        let currPos = this.positions[pos.ticker];
        if(currPos == undefined) currPos = pos;
        else {
            if(Math.sign(currPos.quantity) == Math.sign(pos.quantity) || currPos.quantity == 0) {// increase size of current position
                currPos.quantity += pos.quantity;
                currPos.costBasis += pos.costBasis;
            } else if(Math.abs(currPos.quantity) > Math.abs(pos.quantity)) {// reduce size of current position
                currPos.costBasis += Math.round(currPos.costBasis*pos.quantity/currPos.quantity);
                currPos.quantity += pos.quantity;
            } else {// close current position and open new position in opposite direction
                let posPrice = pos.costBasis/pos.quantity;
                currPos.quantity += pos.quantity;
                currPos.costBasis = currPos.quantity*posPrice;
            }
        }
        this.balance -= pos.costBasis;
        await Trader.collection.updateOne({ _id: this._id }, { $set: { [`positions.${pos.ticker}`]: currPos, balance: this.balance } }, current.mongoSession);
    }

    async calculateOpenPnL(position) {
        return (await orderBook.getLastTradedPrice(position.ticker))*position.quantity - position.costBasis;
    }
}

class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity;
        this.costBasis = args.costBasis;
    }
}

class Order {
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
    static collection = mongoClient.db('RHSX').collection('Orders');

    static assignOrderType(order) {
        if(order.type == LimitOrder.TYPE) return new LimitOrder(order);
        else if(order.type == MarketOrder.TYPE) return new MarketOrder(order);
        else if(order.type == StopOrder.TYPE) return new StopOrder(order);
    }
    static getOrders() {
        return mongoClient.db('RHSX').collection('Orders');
    }
    static async getOrder(_id) {
        let res = await this.collection.findOne({ _id: _id }, current.mongoSession);
        if(res != null) res = this.assignOrderType(res);
        return res;
    }
    static async queryOrder(query) {
        let res = await this.collection.findOne(query, current.mongoSession);
        if(res != null) res = this.assignOrderType(res);
        return res;
    }
    static async queryOrders(query, sort) {
        let res = await this.collection.find(query, current.mongoSession).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = this.assignOrderType(res[i]);
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
    }

    toDisplayBoardString() {}
    toInfoString() {}

    toEmbedFields() {
        return [
            { name: this.type.toUpperCase(), value: '\u200B', inline: true },
            { name: dateStr(this.timestamp), value: `#${this._id}`, inline: true }
        ];
    }

    orderSubmittedString() {
        return `Your ${this.label}: \`${this.toInfoString()}\` is submitted.`;
    }

    orderFilledString() {}

    orderCancelledString(reason) {
        switch(reason) {
            case Order.UNFULFILLABLE:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled.`;
        }
    }

    async setStatus(newStatus, reason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status');
        if(newStatus == this.status) return;

        this.status = newStatus;
        await Order.collection.updateOne({ _id: this._id }, { $set: { status: newStatus } }, current.mongoSession);
        if(current.interaction != null && current.order.equals(this._id)) {
            if(newStatus == Order.IN_QUEUE) current.interaction.editReply(this.orderSubmittedString());
            else if(newStatus == Order.CANCELLED) current.interaction.editReply(this.orderCancelledString(reason));
        }
    }
}

class NormalOrder extends Order {
    constructor(args) {
        super(args);
        this.quantity = args.quantity;
        this.quantityFilled = args.quantityFilled;
        this.netPositionChangeSign = ((this.direction == Order.BUY) ? 1 : -1);
    }

    toStopString() {}

    orderFilledString() {
        return `Your ${this.label}: \`${this.toInfoString()}\` is filled.`;
    }

    getQuantityUnfilled() {
        return this.quantity - this.quantityFilled;
    }

    async increaseQuantityFilled(amount, price) {
        this.quantityFilled += amount;
        await Order.collection.updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } }, current.mongoSession);

        if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED);
        else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED);
        await (await Trader.getTrader(this.user)).addPosition(new Position({
            ticker: this.ticker,
            quantity: amount*this.netPositionChangeSign,
            costBasis: amount*this.netPositionChangeSign*price
        }));
    }
}

class LimitOrder extends NormalOrder {
    static TYPE = 'limit';
    static LABEL = 'limit order';

    constructor(args) {
        super(args);
        this.price = args.price;
        this.type = LimitOrder.TYPE;
        this.label = LimitOrder.LABEL;
    }

    toDisplayBoardString() {
        return `@${Price.format(this.price)} x${this.getQuantityUnfilled()}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker} @${Price.format(this.price)}`;
    }

    toStopString() {
        return `${this.direction} x${this.quantity} @${Price.format(this.price)}`;
    }

    toEmbedFields() {
        const fields = super.toEmbedFields();
        fields.push({ name: `${this.direction} x${this.quantity} ${this.ticker} @${Price.format(this.price)}`, value: `**(x${this.quantityFilled} filled)**`, inline: true });
        return fields;
    }
}

class MarketOrder extends NormalOrder {
    static TYPE = 'market';
    static LABEL = 'market order';

    constructor(args) {
        super(args);
        this.type = MarketOrder.TYPE;
        this.label = MarketOrder.LABEL;
    }

    toDisplayBoardString() {
        return `x${this.quantity}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker}`;
    }

    toStopString() {
        return `${this.direction} x${this.quantity}`;
    }

    toEmbedFields() {
        const fields = super.toEmbedFields();
        fields.push({ name: `${this.direction} x${this.quantity} ${this.ticker}`, value: `**(x${this.quantityFilled} filled)**`, inline: true });
        return fields;
    }
}

class StopOrder extends Order {
    static TYPE = 'stop';
    static LABEL = 'stop order';

    constructor(args) {
        super(args);
        this.triggerPrice = args.triggerPrice;
        if(args.executedOrder.type == LimitOrder.TYPE) this.executedOrder = new LimitOrder(args.executedOrder);
        else if(args.executedOrder.type == MarketOrder.TYPE) this.executedOrder = new MarketOrder(args.executedOrder);
        this.type = StopOrder.TYPE;
        this.label = StopOrder.LABEL;
    }

    toDisplayBoardString() {
        return `@${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    orderFilledString() {
        return `Your ${this.label}: \`${this.toInfoString()}\` is triggered.`;
    }

    toEmbedFields() {
        const fields = super.toEmbedFields();
        fields.push({ name: `${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}`, value: `**${this.executedOrder.toStopString()}**`, inline: true });
        return fields;
    }
}

class Ticker {
    static collection = mongoClient.db('RHSX').collection('Tickers');

    static async getTicker(_id) {
        let res = await this.collection.findOne({ _id: _id }, current.mongoSession);
        if(res != null) res = new Ticker(res);
        return res;
    }
    static async queryTickers(query, sort) {
        let res = await this.collection.find(query, current.mongoSession).sort(sort).toArray();
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
        this.displayBoardMessage = await CHANNEL.DISPLAY_BOARD.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        this.startUpTime = new Date();
        this.updateDisplayBoard();
    }

    async updateDisplayBoard() {
        orderBook.displayBoardMessage.edit(await orderBook.toDisplayBoardString()).then(() => setTimeout(orderBook.updateDisplayBoard, 5500));
    }

    async toDisplayBoardString() {
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
            str += setW(ticker._id, 10) + setW(Price.format(ticker.lastTradedPrice), 10) +
            setW(Price.format(topBid), 10) + setW(Price.format(topAsk), 10) + setW(ticker.volume, 10) + '\n';
        }
        str += '```\n';

        for(const ticker of tickers) {
            str += `Ticker: ${ticker._id}\n`;
            str += '```\n';
            str += setW('Bids', 15) + 'Asks' + '\n';
            let bids = await this.getBids(ticker._id);
            let asks = await this.getAsks(ticker._id);
            for(let i = 0; i < Math.max(bids.length, asks.length); i++) {
                if(i < bids.length) str += setW(bids[i].toDisplayBoardString(), 15);
                else str += setW('', 15);
                if(i < asks.length) str += asks[i].toDisplayBoardString();
                str += '\n';
            }
            str += '```\n';
        }
        return str;
    }

    async getBids(ticker) {
        return await Order.queryOrders({
            direction: Order.BUY,
            ticker: ticker,
            type: LimitOrder.TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: -1, timestamp: 1 });
    }

    async getAsks(ticker) {
        return await Order.queryOrders({
            direction: Order.SELL,
            ticker: ticker,
            type: LimitOrder.TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: 1, timestamp: 1 });
    }

    async #matchOrder(newOrder, existingOrder) {
        const quantity = Math.min(newOrder.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        const price = existingOrder.price;
        await existingOrder.increaseQuantityFilled(quantity, price);
        await newOrder.increaseQuantityFilled(quantity, price);
        await Ticker.collection.updateOne({ _id: existingOrder.ticker }, { $inc: { volume: quantity } }, current.mongoSession);
        return { quantity: quantity, price: price };
    }

    async submitOrder(order) {
        order.timestamp = new Date();
        let dbResponse = await Order.collection.insertOne(order, current.mongoSession);
        order = await Order.getOrder(dbResponse.insertedId);
        console.log(order);
        if(current.order == null) current.order = order._id;

        if(order instanceof NormalOrder) {
            const trader = await Trader.getTrader(order.user);
            const currPosition = trader.positions[order.ticker];
            let extremePosition = (currPosition == undefined ? 0 : currPosition.quantity) + order.quantity;
            (await trader.getPendingOrders()).forEach(pendingOrder => {
                if(pendingOrder.type != StopOrder.TYPE) {
                    if(order.netPositionChangeSign == pendingOrder.netPositionChangeSign) extremePosition += pendingOrder.quantity;
                }
            });
            if(Math.abs(extremePosition) > trader.positionLimit) {
                await this.cancelOrder(order, Order.VIOLATES_POSITION_LIMITS); return;
            }
        }

        await order.setStatus(Order.IN_QUEUE);
        await order.setStatus(Order.NOT_FILLED);
        if(order instanceof LimitOrder) await this.#submitLimitOrder(order);
        else if(order instanceof MarketOrder) await this.#submitMarketOrder(order);
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
                await this.cancelOrder(order, Order.UNFULFILLABLE); return;
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
                await this.cancelOrder(order, Order.UNFULFILLABLE); return;
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

        await Ticker.getTickers().updateOne({ _id: ticker }, { $set: { lastTradedPrice: newPrice } }, current.mongoSession);
        let tickDirection = ((currPrice < newPrice) ? Order.BUY : Order.SELL);
        let triggeredStops = await Order.queryOrders({
            direction: tickDirection,
            ticker: ticker,
            type: StopOrder.TYPE,
            triggerPrice: { $gte: Math.min(currPrice, newPrice), $lte: Math.max(currPrice, newPrice) },
            status: Order.NOT_FILLED
        }, { timestamp: 1 });
        for(const stop of triggeredStops) {
            await stop.setStatus(Order.COMPLETELY_FILLED);
            await this.submitOrder(stop.executedOrder);
        }
    }

    async cancelOrder(order, reason) {
        if(order == null) throw new Error('Invalid id');
        if(order.status == Order.CANCELLED) throw new Error('Order is already cancelled');
        if(order.status == Order.COMPLETELY_FILLED) throw new Error('Order is already filled');
        if(current.order == null) current.order = order._id;
        await order.setStatus(Order.CANCELLED, reason);
    }
}();

let current = {
    interaction: null,
    order: null,
    mongoSession: null
};
const interactionList = [];
const interactionHandler = async function () {
    if(interactionList.length > 0) {
        const interaction = interactionList[0];
        interactionList.splice(0, 1);
        console.log(`started processing interaction ${interaction.id}`);
        current.interaction = interaction;
        current.order = null;
        current.mongoSession = mongoClient.startSession();
        try {
            if(interaction.commandName === 'join') {
                await current.mongoSession.withTransaction(async session => {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader != null) throw new Error('Already a trader');
                    await Trader.collection.insertOne(new Trader({
                        _id: interaction.user.id,
                        positionLimit: Trader.DEFAULT_POSITION_LIMIT,
                        balance: 0,
                        positions: {}
                    }), current.mongoSession);
                });
                interaction.editReply(`You're now a trader.`);

            } else if(interaction.commandName === 'position') {
                await current.mongoSession.withTransaction(async session => {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    interaction.editReply(await trader.toString());
                });

            } else if(interaction.commandName === 'submit') {
                await current.mongoSession.withTransaction(async session => {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    let order = {
                        timestamp: new Date(),
                        user: interaction.user.id,
                        direction: interaction.options.getString('direction'),
                        ticker: interaction.options.getString('ticker'),
                        status: Order.UNSUBMITTED
                    };
                    if(interaction.options.getSubcommandGroup(false) == null) {
                        order.quantity = interaction.options.getInteger('quantity');
                        order.quantityFilled = 0;
                        if(interaction.options.getSubcommand(false) == LimitOrder.TYPE) {
                            order.price = Price.toPrice(interaction.options.getNumber('limit_price'));
                            order.type = LimitOrder.TYPE;
                        } else if(interaction.options.getSubcommand(false) == MarketOrder.TYPE) {
                            order.type = MarketOrder.TYPE;
                        }
                    } else if(interaction.options.getSubcommandGroup(false) == StopOrder.TYPE) {
                        order.triggerPrice = Price.toPrice(interaction.options.getNumber('trigger_price'));
                        order.type = StopOrder.TYPE;
                        const executedOrder = {
                            type: interaction.options.getSubcommand(),
                            timestamp: new Date(),
                            user: interaction.user.id,
                            direction: interaction.options.getString('direction'),
                            ticker: interaction.options.getString('ticker'),
                            status: Order.UNSUBMITTED,
                            quantity: interaction.options.getInteger('quantity'),
                            quantityFilled: 0
                        };
                        if(executedOrder.direction == Order.BUY && !((await orderBook.getLastTradedPrice(order.ticker)) < order.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
                        if(executedOrder.direction == Order.SELL && !(order.triggerPrice < (await orderBook.getLastTradedPrice(order.ticker)))) throw new Error('Trigger price must be less than the current price');
                        if(executedOrder.type == LimitOrder.TYPE) {
                            executedOrder.price = Price.toPrice(interaction.options.getNumber('limit_price'));
                        }
                        order.executedOrder = executedOrder;
                    }
                    order = Order.assignOrderType(order);
                    await orderBook.submitOrder(order);
                });

            } else if(interaction.commandName === 'cancel') {
                await current.mongoSession.withTransaction(async session => {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    const order = await Order.getOrder(new ObjectId(interaction.options.getString('order_id')));
                    await orderBook.cancelOrder(order);
                });
            }
        } catch(error) {
            console.log(error);
            interaction.editReply(`Error: ${error.message}`);
        }
        await current.mongoSession.endSession();
        console.log(`finished processing interaction ${interaction.id}`);
    }
    setTimeout(interactionHandler, 200);
}
discordClient.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return;
    console.log(`received interaction ${interaction.id}`);
    await interaction.deferReply();
    interactionList.push(interaction);
});
discordClient.on('debug', console.log);

const CHANNEL = {};
async function run() {
    await mongoClient.connect();
    console.log(`Connected to MongoDB!`);
    await discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord!`);
    CHANNEL.DISPLAY_BOARD = await discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
    await orderBook.initialize();
    interactionHandler();
}
run();

function setW(value, length) {
    value = String(value);
    return value + ' '.repeat(Math.max(length - value.length, 0));
}
class Price {
    static toPrice(price) {
        return Math.round(price*100);
    }
    static format(price) {
        if(price == null || price == undefined) return '-';
        price = price/100;
        if(Number.isNaN(price)) return '-';
        return Price.round(price).toFixed(2);
    }
    static round(price) {
        return Math.round((price+Number.EPSILON)*100)/100;
    }
}
function dateStr(date) {
    return date.toLocaleString('en-US', { timeZone: 'America/Toronto' });
}
