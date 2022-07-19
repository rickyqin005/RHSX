// Setting up the bot
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('this is a bot'));
app.listen(port, () => console.log(`listening at port ${port}`));

// Bot
const {Client, Intents} = require('discord.js');
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]});


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
            this.#positions.set(ticker, new Position(ticker, 0, 0));
        });
    }

    toString() {
        let str = '';
        str += 'Positions:\n';
        str += '```';
        str += setW('Ticker', 10) + setW('Quantity', 10) + setW('Open PnL', 10) + '\n';
        this.#positions.forEach(position => {
            if(position.getQuantity() != 0) {
                str += setW(position.getTicker(), 10) + setW(position.getQuantity(), 10) + setW(pricef(position.calculateOpenPnL()), 10) + '\n';
            }
        });
        str += '```\n';
        str += 'Pending Orders:\n';
        str += '```';
        let items = 0;
        orderBook.filter(order => {
            return (order.getUser() == this.#user && (order.getStatus() == Order.NOT_FILLED || order.getStatus() == Order.PARTIALLY_FILLED));
        }).forEach(order => {
            str += `${order.toDetailedInfoString()}\n`; items++;
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

    addPosition(position) {
        this.#positions.get(position.getTicker()).add(position);
    }
}

class Position {
    #ticker;
    #quantity;
    #costBasis;

    constructor(ticker, quantity, costBasis) {
        this.#ticker = ticker;
        this.#quantity = quantity;
        this.#costBasis = costBasis;
    }

    getTicker() {
        return this.#ticker;
    }

    getQuantity() {
        return this.#quantity;
    }

    getCostBasis() {
        return this.#costBasis;
    }

    add(anotherPosition) {
        if(this.#ticker != anotherPosition.#ticker) throw new Error('Positions of different tickers cannot be added.');
        this.#quantity += anotherPosition.#quantity;
        this.#costBasis += anotherPosition.#costBasis;
    }

    calculateOpenPnL() {
        return orderBook.getTicker(this.#ticker).getLastTradedPrice()*this.#quantity - this.#costBasis;
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
    #status = Order.UNSUBMITTED;

    constructor(user, direction, ticker) {
        this.#id = Order.#getNextId();
        this.#timestamp = new Date();
        this.#user = user;
        this.#direction = direction;
        this.#ticker = ticker;
    }

    toDisplayBoardString() {}

    toInfoString() {}

    toDetailedInfoString() {}

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

    setStatus(newStatus, reason = undefined) {
        if(!(0 <= newStatus && newStatus <= 5)) throw new Error('Invalid status.');
        if(newStatus == this.#status) return;
        this.#status = newStatus;
        if(newStatus == Order.NOT_FILLED) messageQueue.add(this.orderSubmittedString(), MessageQueue.SEND);
        else if(newStatus == Order.COMPLETELY_FILLED) messageQueue.add(this.orderFilledString(), MessageQueue.SEND);
        else if(newStatus == Order.CANCELLED) messageQueue.add(this.orderCancelledString(reason), MessageQueue.SEND);
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
        let price = existingOrder.getPrice();
        existingOrder.#increaseQuantityFilled(quantityTradable, price);
        this.#increaseQuantityFilled(quantityTradable, price);
        return existingOrder.getPrice();
    }

    #increaseQuantityFilled(amount, price) {
        this.#quantityFilled += amount;
        if(this.#quantityFilled == 0) this.setStatus(Order.NOT_FILLED);
        else if(this.#quantityFilled < this.#quantity) this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.#quantityFilled == this.#quantity) this.setStatus(Order.COMPLETELY_FILLED);
        let position = new Position(this.getTicker(), amount*this.getNetPositionChangeSign(), amount*this.getNetPositionChangeSign()*price);
        traders.get(this.getUser()).addPosition(position);
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
        return `x${this.getQuantityUnfilled()} @${pricef(this.getPrice())}`;
    }

    toInfoString() {
        return `#${this.getId()}, ${this.getDirection()} x${this.getQuantity()} ${this.getTicker()} @${pricef(this.getPrice())}`;
    }

    toDetailedInfoString() {
        return `#${this.getId()}, ${this.getDirection()} x${this.getQuantity()} (x${this.getQuantityFilled()} filled) ${this.getTicker()} @${pricef(this.getPrice())}, submitted ${dateString(this.getTimestamp())}`;
    }

    toStopString() {
        return `${this.getDirection()} ${this.getCode()} x${this.getQuantity()} @${pricef(this.getPrice())}`;
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

    toDetailedInfoString() {
        return `#${this.getId()}, ${this.getDirection()} x${this.getQuantity()} (x${this.getQuantityFilled()} filled) ${this.getTicker()}, submitted ${dateString(this.getTimestamp())}`;
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
        return `@${pricef(this.getTriggerPrice())}, ${this.#executedOrder.toStopString()}`;
    }

    toInfoString() {
        return `#${this.getId()}, ${this.#executedOrder.getTicker()} @${pricef(this.getTriggerPrice())}, ${this.#executedOrder.toStopString()}`;
    }

    toDetailedInfoString() {
        return `#${this.getId()}, ${this.#executedOrder.getTicker()} @${pricef(this.getTriggerPrice())}, ${this.#executedOrder.toStopString()}, submitted ${dateString(this.getTimestamp())}`;
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

    setLastTradedPrice(newPrice) {
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
            this.#removeStopOrder(stop);
        });
        hitStops.forEach(stop => {
            stop.setStatus(Order.COMPLETELY_FILLED);
            orderBook.processOrder(stop.getExecutedOrder());
        });
    }

    submitOrder(order) {
        if(order instanceof LimitOrder) {
            this.#addLimitOrder(order);
        } else if(order instanceof MarketOrder) {
            this.#addMarketOrder(order);
        } else if(order instanceof StopOrder) {
            this.#addStopOrder(order);
        }
    }

    #addLimitOrder(order) {
        let newLastTradedPrice = this.getLastTradedPrice();
        if(order.getDirection() == Order.BUY) {
            while(!this.asks.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = this.asks.peek();
                if(order.getPrice() < bestAsk.getPrice()) break;
                newLastTradedPrice = order.match(bestAsk);
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) this.asks.poll();
            }
            if(order.getStatus() != Order.COMPLETELY_FILLED) this.bids.add(order);

        } else if(order.getDirection() == Order.SELL) {
            while(!this.bids.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = this.bids.peek();
                if(bestBid.getPrice() < order.getPrice()) break;
                newLastTradedPrice = order.match(bestBid);
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) this.bids.poll();
            }
            if(order.getStatus() != Order.COMPLETELY_FILLED) this.asks.add(order);
        }
        this.setLastTradedPrice(newLastTradedPrice);
    }

    #addMarketOrder(order) {
        let newLastTradedPrice = this.getLastTradedPrice();
        if(order.getDirection() == Order.BUY) {
            if(order.getQuantity() > this.getAsksDepth()) {
                this.cancelOrder(order, Order.UNFULFILLABLE); return;
            }
            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = this.asks.peek();
                newLastTradedPrice = order.match(bestAsk);
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) this.asks.poll();
            }
        } else if(order.getDirection() == Order.SELL) {
            if(order.getQuantity() > this.getBidsDepth()) {
                this.cancelOrder(order, Order.UNFULFILLABLE); return;
            }
            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = this.bids.peek();
                newLastTradedPrice = order.match(bestBid);
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) this.bids.poll();
            }
        }
        this.setLastTradedPrice(newLastTradedPrice);
    }

    #addStopOrder(order) {
        if(order.getDirection() == Order.BUY) {
            this.buyStops.add(order);
        } else if(order.getDirection() == Order.SELL) {
            this.sellStops.add(order);
        }
    }

    cancelOrder(order, reason) {
        if(order instanceof LimitOrder) this.#removeLimitOrder(order);
        else if(order instanceof StopOrder) this.#removeStopOrder(order);
        order.setStatus(Order.CANCELLED, reason);
    }

    #removeLimitOrder(order) {
        if(order.getDirection() == Order.BUY) this.bids.remove(this.bids.indexOf(order));
        else if(order.getDirection() == Order.SELL) this.asks.remove(this.asks.indexOf(order));
    }

    #removeStopOrder(stop) {
        if(stop.getDirection() == Order.BUY) this.buyStops.remove(this.buyStops.indexOf(stop));
        else if(stop.getDirection() == Order.SELL) this.sellStops.remove(this.sellStops.indexOf(stop));
    }
}


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

    #allOrders = new Map();
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
        messageQueue.add(this.toDisplayBoardString(), MessageQueue.EDIT, this.#displayBoardMessage);
    }

    toDisplayBoardString() {
        let str = '';
        str += `Last updated at ${dateString(new Date())}\n`;
        str += '```\n';
        str += setW('Ticker', 10) + setW('Price', 10) + setW('Bid', 10) + setW('Ask', 10) + '\n';
        this.#tickers.forEach(ticker => {
            let topBid = ticker.bids.peek();
            if(topBid != null) topBid = topBid.getPrice();
            let topAsk = ticker.asks.peek();
            if(topAsk != null) topAsk = topAsk.getPrice();

            str += setW(ticker.getSymbol(), 10) + setW(pricef(ticker.getLastTradedPrice()), 10) +
            setW(pricef(topBid), 10) + setW(pricef(topAsk), 10) + '\n';
        });
        str += '```\n';
        this.#tickers.forEach(ticker => {
            str += ticker.toString() + '\n';
        });
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
        return this.#allOrders.get(id);
    }

    submitOrder(user, direction, args) {
        let order;
        try {
            let code = args[1];
            let ticker = args[2];
            if(code == LimitOrder.CODE) {
                let quantity = parseInt(args[3]);
                let price = toPrice(args[4]);
                order = new LimitOrder(user, direction, ticker, quantity, price);
            } else if(code == MarketOrder.CODE) {
                let quantity = parseInt(args[3]);
                order = new MarketOrder(user, direction, ticker, quantity);
            } else if(code == StopOrder.CODE) {
                let triggerPrice = toPrice(args[3]);
                let triggerCode = args[4];
                let triggerQuantity = parseInt(args[5]);
                if(triggerCode == LimitOrder.CODE) {
                    let triggerLimitPrice = toPrice(args[6]);
                    let executedOrder = new LimitOrder(user, direction, ticker, triggerQuantity, triggerLimitPrice);
                    order = new StopOrder(user, direction, ticker, triggerPrice, executedOrder);
                } else if(triggerCode == MarketOrder.CODE) {
                    let executedOrder = new MarketOrder(user, direction, ticker, triggerQuantity);
                    order = new StopOrder(user, direction, ticker, triggerPrice, executedOrder);
                } else throw new Error(`Triggered order type must be one of \`${LimitOrder.CODE}\` or \`${MarketOrder.CODE}\`.`);
            } else throw new Error(`Order type must be one of \`${LimitOrder.CODE}\`, \`${MarketOrder.CODE}\` or \`${StopOrder.CODE}\`.`);

            order.validate();
        } catch(error) {
            messageQueue.add(error.message, MessageQueue.SEND); return;
        }
        this.processOrder(order);
    }

    processOrder(order) {
        this.#allOrders.set(order.getId(), order);
        order.setStatus(Order.NOT_FILLED);
        this.getTicker(order.getTicker()).submitOrder(order);
        this.#updateDisplayBoard();
    }

    cancelOrder(orderId, reason) {
        let order = orderBook.getOrderById(orderId);
        if(order == undefined) throw new Error('Invalid id.');
        if(order.getStatus() == Order.CANCELLED) throw new Error('Order is already cancelled.');
        if(order.getStatus() == Order.COMPLETELY_FILLED) throw new Error('Order is already filled.');
        this.getTicker(order.getTicker()).cancelOrder(order, reason);
        this.#updateDisplayBoard();
    }

    filter(funct) {
        let result = [];
        this.#allOrders.forEach(order => {
            if(funct(order)) result.push(order);
        });
        return result;
    }
}
let orderBook = new OrderBook();

class MessageQueue {
    static SEND = 'send';
    static EDIT = 'edit';
    #messages = [];
    #channel;
    constructor() {}

    async initialize() {
        this.#channel = await client.channels.fetch(process.env['BOT_SPAM_CHANNEL_ID']);
        setInterval(() => {
            this.#processNextMessage();
        }, 1000);
    }

    add(string, type, messageObj) {
        if(type == MessageQueue.SEND) this.#messages.push({type: type, content: string});
        else this.#messages.push({type: type, content: string, messageObj: messageObj});
    }

    #processNextMessage() {
        if(this.#messages.length > 0) {
            let item = this.#messages[0];
            if(item.type == MessageQueue.SEND) this.#channel.send(item.content);
            else if(item.type == MessageQueue.EDIT) item.messageObj.edit(item.content);
            this.#messages.splice(0, 1);
        }
    }
}
let messageQueue = new MessageQueue();

client.once('ready', c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});
client.on('ready', async() => {
    await orderBook.initialize();
    await messageQueue.initialize();
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
                `!cancel [order id]\n` +
                '```';
            messageQueue.add(infoString, MessageQueue.SEND);
            break;
        }

        case '!bot':
            messageQueue.add(`Active since ${dateString(orderBook.getStartUpTime())}.`, MessageQueue.SEND);
            break;

        case '!join':
            if(isValidTrader(msg.author)) return;
            traders.set(msg.author, new Trader(msg.author));
            messageQueue.add(`${pingString(msg.author)} You've been added to the trader list.`, MessageQueue.SEND);
            break;

        case '!position':
            if(!isValidTrader(msg.author)) return;
            messageQueue.add(traders.get(msg.author).toString(), MessageQueue.SEND);
            break;

        case '!buy': {
            if(!isValidTrader(msg.author)) return;
            orderBook.submitOrder(msg.author, Order.BUY, args);
            break;
        }

        case '!sell': {
            if(!isValidTrader(msg.author)) return;
            orderBook.submitOrder(msg.author, Order.SELL, args);
            break;
        }

        case '!cancel': {
            if(!isValidTrader(msg.author)) return;
            try {
                orderBook.cancelOrder(parseInt(args[1]), undefined);
            } catch(error) {
                messageQueue.add(error.message, MessageQueue.SEND);
            }
            break;
        }
    }
});

client.on('debug', console.log);

client.login(process.env['BOT_TOKEN']);


function pingString(user) {
    return `<@${user.id}>`;
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
    return (price/100).toFixed(2);
}

function dateString(date) {
    return date.toLocaleString('en-US', {timeZone: 'America/Toronto'});
}
