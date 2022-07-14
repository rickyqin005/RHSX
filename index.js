// Setting up the bot
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('this is a bot'));
app.listen(port, () => console.log(`listening at port ${port}`));

// Bot
const {Client, Intents} = require('discord.js');
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]});


// Traders
const traders = new Map();

function isValidTrader(user) {
    return (traders.get(user) != undefined);
}

class Trader {
    static #DEFAULT_POSITION_LIMIT = 100000;

    #user;
    #positionLimit;
    #positions = new Map();

    constructor(user) {
        this.#user = user;
        this.#positionLimit = Trader.#DEFAULT_POSITION_LIMIT;
        OrderBook.VALID_TICKERS.forEach(ticker => {
            this.#positions.set(ticker, 0);
        });
    }

    toString() {
        let str = '';
        str += 'Position:\n';
        str += '```';
        let items = 0;
        this.#positions.forEach((position, ticker) => {
            if(position != 0) {
                str += setW(ticker, 8) + position + '\n'; items++;
            }
        });
        if(items == 0) str += ' ';
        str += '```\n';

        str += 'Pending Orders:\n';
        str += '```';
        items = 0;
        orderBook.filter(order => {
            return (order.getUser() == this.#user && (order.getStatus() == Order.NOT_FILLED || order.getStatus() == Order.PARTIALLY_FILLED));
        }).forEach(order => {
            str += `${order.toInfoString()}\n`; items++;
        });
        if(items == 0) str += ' ';
        str += '```';
        return str;
    }

    getUser() {
        return this.#user;
    }

    getPositionLimit() {
        return this.#positionLimit;
    }

    increasePosition(ticker, change) {
        this.#positions.set(ticker, this.#positions.get(ticker) + change);
    }
}


class Order {
    static #usedIds = new Set();
    static #getNextId() {
        let id;
        do {
            id = Math.floor(Math.random()*900000)+100000;
        } while(Order.#usedIds.has(id));
        Order.#usedIds.add(id);
        return id;
    }
    static BUY = 'BUY';
    static SELL = 'SELL';
    static UNSUBMITTED = 0;
    static IN_QUEUE = 1;
    static NOT_FILLED = 2;
    static PARTIALLY_FILLED = 3;
    static COMPLETELY_FILLED = 4;
    static CANCELLED = 5;
    static UNFULFILLABLE = 0;
    static VIOLATES_POSITION_LIMITS = 1;

    #id;
    #timestamp;
    #user;
    #direction;
    #ticker;
    #status = Order.NOT_FILLED;

    constructor(user, direction, ticker) {
        this.#id = Order.#getNextId();
        this.#timestamp = new Date();
        this.#user = user;
        this.#direction = direction;
        this.#ticker = ticker;
    }

    toDisplayBoardString() {}

    toInfoString() {}

    orderSubmittedString() {
        return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is submitted.`;
    }

    orderFilledString() {
        return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is filled.`;
    }

    orderCancelledString(reason) {
        switch(reason) {
            case Order.UNFULFILLABLE:
                return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled.`;
        }
    }

    getId() {
        return this.#id;
    }

    getTimestamp() {
        return this.#timestamp;
    }

    getUser() {
        return this.#user;
    }

    getDirection() {
        return this.#direction;
    }

    getTicker() {
        return this.#ticker;
    }

    getType() {}

    getCode() {}

    getStatus() {
        return this.#status;
    }

    setStatus(newStatus) {
        if(!(0 <= newStatus && newStatus <= 5)) throw new Error('Invalid status.');
        this.#status = newStatus;
    }

    validate() {
        if(!isValidTrader(this.#user)) throw new Error('Invalid trader.');
        if(!(this.#direction == Order.BUY || this.#direction == Order.SELL))
            throw new Error(`'Direction' must be one of \`${Order.BUY}\` or \`${Order.SELL}\`.`);
        if(!orderBook.hasTicker(this.#ticker)) throw new Error(`Invalid ticker \`${this.#ticker}\`.`);
    }
}

class NormalOrder extends Order {
    #quantity;
    #quantityFilled;

    constructor(user, direction, ticker, quantity) {
        super(user, direction, ticker);
        this.#quantity = quantity;
        this.#quantityFilled = 0;
    }

    toStopString() {}

    getQuantity() {
        return this.#quantity;
    }

    getQuantityFilled() {
        return this.#quantityFilled;
    }

    getQuantityUnfilled() {
        return this.#quantity - this.#quantityFilled;
    }

    getNetPositionChangeSign() {
        if(this.getDirection() == Order.BUY) return 1;
        else return -1;
    }

    getNetPositionChange() {
        return this.getQuantityUnfilled() * this.getNetPositionChangeSign();
    }

    validate() {
        super.validate();
        if(Number.isNaN(this.#quantity) || !(1 <= this.#quantity)) throw new Error('Quantity must be greater than 0.');
    }

    match(existingOrder) {
        let quantityTradable = Math.min(this.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        this.#increaseQuantityFilled(quantityTradable);
        existingOrder.#increaseQuantityFilled(quantityTradable);
    }

    #increaseQuantityFilled(amount) {
        this.#quantityFilled += amount;
        if(this.#quantityFilled == 0) this.setStatus(Order.NOT_FILLED);
        else if(this.#quantityFilled < this.#quantity) this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.#quantityFilled == this.#quantity) this.setStatus(Order.COMPLETELY_FILLED);
        traders.get(this.getUser()).increasePosition(this.getTicker(), amount * this.getNetPositionChangeSign());
    }
}

class LimitOrder extends NormalOrder {
    static TYPE = 'limit order';
    static CODE = 'LIMIT';

    #price;

    constructor(user, direction, ticker, quantity, price) {
        super(user, direction, ticker, quantity);
        this.#price = price;
    }

    toDisplayBoardString() {
        return `x${this.getQuantityUnfilled()} @${this.getPrice()}`;
    }

    toInfoString() {
        return `#${this.getId()}, ${this.getDirection()} x${this.getQuantity()} ${this.getTicker()} @${this.getPrice()}`;
    }

    toStopString() {
        return `${this.getDirection()} ${this.getCode()} x${this.getQuantity()} @${this.getPrice()}`;
    }

    getType() {
        return LimitOrder.TYPE;
    }

    getCode() {
        return LimitOrder.CODE;
    }

    getPrice() {
        return this.#price;
    }

    validate() {
        super.validate();
        if(Number.isNaN(this.#price)) throw new Error('Invalid limit price.');
    }
}

class MarketOrder extends NormalOrder {
    static TYPE = 'market order';
    static CODE = 'MARKET';

    constructor(user, direction, ticker, quantity) {
        super(user, direction, ticker, quantity);
    }

    toDisplayBoardString() {
        return `x${this.getQuantity()}`;
    }

    toInfoString() {
        return `#${this.getId()}, ${this.getDirection()} x${this.getQuantity()} ${this.getTicker()}`;
    }

    toStopString() {
        return `${this.getDirection()} ${this.getCode()} x${this.getQuantity()}`;
    }

    getType() {
        return MarketOrder.TYPE;
    }

    getCode() {
        return MarketOrder.CODE;
    }
}

class StopOrder extends Order {
    static TYPE = 'stop order';
    static CODE = 'STOP';

    #triggerPrice;
    #executedOrder;

    constructor(user, direction, ticker, triggerPrice, executedOrder) {
        super(user, direction, ticker);
        this.#triggerPrice = triggerPrice;
        this.#executedOrder = executedOrder;
    }

    toDisplayBoardString() {
        return `@${this.getTriggerPrice()}, ${this.#executedOrder.toStopString()}`;
    }

    toInfoString() {
        return `#${this.getId()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopString()}`;
    }

    orderFilledString() {
        return `${pingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is triggered.`;
    }

    getType() {
        return StopOrder.TYPE;
    }

    getCode() {
        return StopOrder.CODE;
    }

    getTriggerPrice() {
        return this.#triggerPrice;
    }

    getExecutedOrder() {
        return this.#executedOrder;
    }

    validate() {
        super.validate();
        if(Number.isNaN(this.getTriggerPrice())) throw new Error('Invalid trigger price.');
        let ticker = orderBook.getTicker(this.getTicker());
        if(this.getDirection() == Order.BUY && !(ticker.getLastTradedPrice() < this.getTriggerPrice())) {
            throw new Error('Trigger price must be greater than current price.');
        }
        if(this.getDirection() == Order.SELL && !(this.getTriggerPrice() < ticker.getLastTradedPrice())) {
            throw new Error('Trigger price must be less than current price.');
        }
        this.#executedOrder.validate();
    }
}


// Tickers
class PriorityQueue {
    #array = [];
    #comparator;

    constructor(comparator) {
        this.#comparator = comparator;
    }

    size() {
        return this.#array.length;
    }

    empty() {
        return (this.#array.length == 0);
    }

    add(element) {
        let idx = 0;
        for(; idx < this.#array.length; idx++) {
            if(this.#comparator(element, this.#array[idx])) {
                this.#array.splice(idx, 0, element); return;
            }
        }
        this.#array.splice(idx, 0, element);
    }

    peek() {
        if(this.#array.length == 0) return null;
        return this.#array[0];
    }

    poll() {
        if(this.#array.length == 0) return null;
        return this.remove(0);
    }

    remove(index) {
        let obj = this.#array[index];
        this.#array.splice(index, 1);
        return obj;
    }

    get(index) {
        return this.#array[index];
    }

    indexOf(object) {
        return this.#array.indexOf(object);
    }

    forEach(funct) {
        this.#array.forEach(funct);
    }

    filter(funct) {
        return this.#array.filter(funct);
    }
}

class Ticker {
    static #DEFAULT_STARTING_PRICE = 50;

    #symbol;
    #lastTradedPrice = Ticker.#DEFAULT_STARTING_PRICE;
    bids = new PriorityQueue(OrderBook.BIDS_COMPARATOR);
    asks = new PriorityQueue(OrderBook.ASKS_COMPARATOR);
    buyStops = new PriorityQueue(OrderBook.TIMESTAMP_COMPARATOR);
    sellStops = new PriorityQueue(OrderBook.TIMESTAMP_COMPARATOR);

    constructor(symbol) {
        this.#symbol = symbol;
    }

    toString() {
        let str = '';
        str += `Ticker: ${this.getSymbol()}\n`;
        str += '```\n';

        str += setW('Bids', 20) + 'Asks' + '\n';

        for(let i = 0; i < Math.max(this.bids.size(), this.asks.size()); i++) {
            if(i <= this.bids.size()-1) str += setW(this.bids.get(i).toDisplayBoardString(), 20);
            else str += setW('', 20);
            if(i <= this.asks.size()-1) str += this.asks.get(i).toDisplayBoardString();
            str += '\n';
        }
        str += '```';
        return str;
    }

    getSymbol() {
        return this.#symbol;
    }

    getLastTradedPrice() {
        return this.#lastTradedPrice;
    }

    getBidsDepth() {
        let sum = 0;
        this.bids.forEach(bid => {
            sum += bid.getQuantityUnfilled();
        });
        return sum;
    }

    getAsksDepth() {
        let sum = 0;
        this.asks.forEach(ask => {
            sum += ask.getQuantityUnfilled();
        });
        return sum;
    }

    setLastTradedPrice(newPrice, channel) {
        if(this.#lastTradedPrice == newPrice) return;
        let currPrice = this.#lastTradedPrice;
        this.#lastTradedPrice = newPrice;

        let tickDirection = '';
        if(currPrice < newPrice) tickDirection = Order.BUY;
        else tickDirection = Order.SELL;

        let hitStops;
        if(tickDirection == Order.BUY) {
            hitStops = this.buyStops.filter((stop) => {
                return (stop.getDirection() == tickDirection && currPrice < stop.getTriggerPrice() && stop.getTriggerPrice() <= newPrice);
            });
        } else {
            hitStops = this.sellStops.filter((stop) => {
                return (stop.getDirection() == tickDirection && newPrice <= stop.getTriggerPrice() && stop.getTriggerPrice() < currPrice);
            });
        }
        hitStops.forEach(stop => {
            this.removeStop(stop);
        });
        hitStops.forEach(stop => {
            stop.setStatus(Order.COMPLETELY_FILLED);
            channel.send(stop.orderFilledString());
            orderBook.processOrder(stop.getExecutedOrder(), channel);
        });
    }

    submitOrder(order, channel) {
        if(order instanceof LimitOrder) {
            this.#submitLimitOrder(order, channel);
        } else if(order instanceof MarketOrder) {
            this.#submitMarketOrder(order, channel);
        } else if(order instanceof StopOrder) {
            this.#submitStopOrder(order, channel);
        }
    }

    #submitLimitOrder(order, channel) {
        let newLastTradedPrice = this.getLastTradedPrice();
        if(order.getDirection() == Order.BUY) {
            while(!this.asks.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = this.asks.peek();
                if(order.getPrice() < bestAsk.getPrice()) break;
                order.match(bestAsk);
                newLastTradedPrice = bestAsk.getPrice();
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.orderFilledString());
                    this.asks.poll();
                }
            }
            if(order.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.orderFilledString());
            else this.bids.add(order);

        } else if(order.getDirection() == Order.SELL) {
            while(!this.bids.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = this.bids.peek();
                if(bestBid.getPrice() < order.getPrice()) break;
                order.match(bestBid);
                newLastTradedPrice = bestBid.getPrice();
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.orderFilledString());
                    this.bids.poll();
                }
            }
            if(order.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.orderFilledString());
            else this.asks.add(order);
        }
        this.setLastTradedPrice(newLastTradedPrice, channel);
    }

    #submitMarketOrder(order, channel) {
        let newLastTradedPrice = this.getLastTradedPrice();
        if(order.getDirection() == Order.BUY) {
            if(order.getQuantity() > this.getAsksDepth()) {
                this.cancelOrder(order, Order.UNFULFILLABLE, channel); return;
            }

            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = this.asks.peek();
                order.match(bestAsk);
                newLastTradedPrice = bestAsk.getPrice();
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.orderFilledString());
                    this.asks.poll();
                }
            }

        } else if(order.getDirection() == Order.SELL) {
            if(order.getQuantity() > this.getBidsDepth()) {
                this.cancelOrder(order, Order.UNFULFILLABLE, channel); return;
            }

            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = this.bids.peek();
                order.match(bestBid);
                newLastTradedPrice = bestBid.getPrice();
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.orderFilledString());
                    this.bids.poll();
                }
            }
        }
        channel.send(order.orderFilledString());
        this.setLastTradedPrice(newLastTradedPrice, channel);
    }

    #submitStopOrder(order, channel) {
        if(order.getDirection() == Order.BUY) {
            this.buyStops.add(order);
        } else if(order.getDirection() == Order.SELL) {
            this.sellStops.add(order);
        }
    }

    cancelOrder(order, reason, channel) {
        order.setStatus(Order.CANCELLED);
        channel.send(order.orderCancelledString(reason));
    }

    removeStop(stop) {
        if(stop.getDirection() == Order.BUY) {
            this.buyStops.remove(this.buyStops.indexOf(stop));
        } else if(stop.getDirection() == Order.SELL) {
            this.sellStops.remove(this.sellStops.indexOf(stop));
        }
    }
}


// Orderbook
class OrderBook {
    static BIDS_COMPARATOR = function(a, b) {
        if(a.getPrice() == b.getPrice()) return a.getTimestamp() < b.getTimestamp();
        return a.getPrice() > b.getPrice();
    }
    static ASKS_COMPARATOR = function(a, b) {
        if(a.getPrice() == b.getPrice()) return a.getTimestamp() < b.getTimestamp();
        return a.getPrice() < b.getPrice();
    }
    static TIMESTAMP_COMPARATOR = function(a, b) {
        return a.getTimestamp() < b.getTimestamp();
    }
    static VALID_TICKERS = ['CRZY', 'TAME'];

    #allOrders = new PriorityQueue(OrderBook.TIMESTAMP_COMPARATOR);
    #tickers = new Map();
    #displayBoardMessage;
    #startUpTime;

    constructor() {
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            this.#tickers.set(OrderBook.VALID_TICKERS[i], new Ticker(OrderBook.VALID_TICKERS[i]));
        }
    }

    async initialize() {
        let channel = await client.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
        this.#displayBoardMessage = await channel.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        this.#updateDisplayBoard();
        setInterval(() => {
            this.#updateDisplayBoard();
        }, 1000*60);
        this.#startUpTime = new Date();
    }

    #updateDisplayBoard() {
        let str = '';
        str += `Last updated at ${new Date().toLocaleString('en-US', {timeZone: 'America/Toronto'})}\n`;
        str += this.toString() + '\n';
        this.#tickers.forEach(ticker => {
            str += ticker.toString() + '\n';
        });
        this.#displayBoardMessage.edit(str);
    }

    toString() {
        let str = '```' + '\n';
        str += setW('Ticker', 10) + setW('Price', 10) + setW('Bid', 10) + setW('Ask', 10) + '\n';

        this.#tickers.forEach(ticker => {
            let topBid = ticker.bids.peek();
            if(topBid == null) topBid = '-';
            else topBid = topBid.getPrice();
            let topAsk = ticker.asks.peek();
            if(topAsk == null) topAsk = '-';
            else topAsk = topAsk.getPrice();

            str += setW(ticker.getSymbol(), 10) + setW(ticker.getLastTradedPrice(), 10) +
            setW(topBid, 10) + setW(topAsk, 10) + '\n';
        });
        str += '```';
        return str;
    }

    getTicker(ticker) {
        return this.#tickers.get(ticker);
    }

    hasTicker(ticker) {
        return OrderBook.VALID_TICKERS.includes(ticker);
    }

    getStartUpTime() {
        return this.#startUpTime;
    }

    getOrderById(id) {
        if(!(1 <= id && id <= this.#allOrders.size())) throw new Error('Invalid id.');
        return this.#allOrders.get(id-1);
    }

    submitOrder(msg, args, direction, channel) {
        let order;
        try {
            if(args[1] == LimitOrder.CODE) {
                order = new LimitOrder(msg.author, direction, args[2], parseInt(args[3]), parseInt(args[4]));
            } else if(args[1] == MarketOrder.CODE) {
                order = new MarketOrder(msg.author, direction, args[2], parseInt(args[3]));
            } else if(args[1] == StopOrder.CODE) {
                if(args[4] == LimitOrder.CODE) {
                    let executedOrder = new LimitOrder(msg.author, direction, args[2], parseInt(args[5]), parseInt(args[6]));
                    order = new StopOrder(msg.author, direction, args[2], parseInt(args[3]), executedOrder);
                } else if(args[4] == MarketOrder.CODE) {
                    let executedOrder = new MarketOrder(msg.author, direction, args[2], parseInt(args[5]));
                    order = new StopOrder(msg.author, direction, args[2], parseInt(args[3]), executedOrder);
                } else throw new Error(`Triggered order type must be one of \`${LimitOrder.CODE}\` or \`${MarketOrder.CODE}\`.`);
            } else throw new Error(`Order type must be one of \`${LimitOrder.CODE}\`, \`${MarketOrder.CODE}\` or \`${StopOrder.CODE}\`.`);

            order.validate();
        } catch(error) {
            channel.send(error.message); return;
        }
        this.processOrder(order, channel);
    }

    processOrder(order, channel) {
        this.#allOrders.add(order);
        order.setStatus(Order.NOT_FILLED);
        channel.send(order.orderSubmittedString());
        this.getTicker(order.getTicker()).submitOrder(order, channel);
        this.#updateDisplayBoard(order.getTicker());
    }

    cancelOrder(order, reason, channel) {
        this.getTicker(order.getTicker()).cancelOrder(order, reason, channel);
    }

    filter(funct) {
        return this.#allOrders.filter(funct);
    }
}
let orderBook = new OrderBook();

client.once('ready', c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});
client.on('ready', async() => {
    await orderBook.initialize();
});

client.on('messageCreate', (msg) => {
    if(msg.author == process.env['BOT_ID']) return;

    let args = msg.content.split(' ');
    switch(args[0]) {
        case '!help': {
            let infoString =
                '```\n' +
                `!help\n` +
                `!bot\n` +
                `!join\n` +
                `!position\n` +
                `!buy ${LimitOrder.CODE} [ticker] [quantity] [price]\n` +
                `!sell ${LimitOrder.CODE} [ticker] [quantity] [price]\n` +
                `!buy ${MarketOrder.CODE} [ticker] [quantity]\n` +
                `!sell ${MarketOrder.CODE} [ticker] [quantity]\n` +
                `!buy ${StopOrder.CODE} [ticker] [trigger price] [order type] [quantity] [[price]]\n` +
                `!sell ${StopOrder.CODE} [ticker] [trigger price] [order type] [quantity] [[price]]\n` +
                '```\n';
            msg.channel.send(infoString);
            break;
        }

        case '!bot':
            msg.channel.send(`Active since ${orderBook.getStartUpTime().toLocaleString('en-US', {timeZone: 'America/Toronto'})}.`);
            break;

        case '!join':
            if(isValidTrader(msg.author)) return;

            msg.channel.send(`${pingString(msg.author)} You've been added to the trader list.`);
            traders.set(msg.author, new Trader(msg.author));
            break;

        case '!position':
            if(!isValidTrader(msg.author)) return;

            msg.channel.send(traders.get(msg.author).toString());
            break;

        case '!buy': {
            if(!isValidTrader(msg.author)) return;

            orderBook.submitOrder(msg, args, Order.BUY, msg.channel);
            break;
        }

        case '!sell': {
            if(!isValidTrader(msg.author)) return;

            orderBook.submitOrder(msg, args, Order.SELL, msg.channel);
            break;
        }

        case '!cancel': {
            if(!isValidTrader(msg.author)) return;

            try {
                orderBook.cancelOrder(orderBook.getOrderById(parseInt(args[1])), undefined, msg.channel);
            } catch(error) {
                msg.channel.send(error.message);
            }
            break;
        }
    }
});

client.on('debug', console.log);

client.login(process.env['BOT_TOKEN']);

// Utility functions
function pingString(user) {
    return `<@${user.id}>`;
}

function setW(value, length) {
    value = String(value);
    return value + ' '.repeat(Math.max(length - value.length, 0));
}
