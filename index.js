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
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            this.#positions.set(OrderBook.VALID_TICKERS[i], 0);
        }
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
        orderBook.filter(orderBookItem => {
            return (orderBookItem.content.getUser() == this.#user && (orderBookItem.content.getStatus() == Order.NOT_FILLED || orderBookItem.content.getStatus() == Order.PARTIALLY_FILLED));
        }).forEach(orderBookItem => {
            str += `${orderBookItem.content.toInfoString()}\n`; items++;
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


// Orders
class Order {
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

    #user;
    #direction;
    #ticker;
    #status = Order.UNSUBMITTED;

    constructor(user, direction, ticker) {
        this.#user = user;
        this.#direction = direction;
        this.#ticker = ticker;
    }

    toDisplayBoardString() {}

    toInfoString() {}

    orderSubmittedString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is submitted.`;
    }

    orderFilledString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is filled.`;
    }

    orderCancelledString(reason) {
        switch (reason) {
            case Order.UNFULFILLABLE:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is cancelled.`;
        }
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
        return `${this.getDirection()} x${this.getQuantityUnfilled()} ${this.getTicker()} @${this.getPrice()}`;
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
        return `${this.getDirection()} x${this.getQuantityUnfilled()} ${this.getTicker()}`;
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
        return `${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopString()}`;
    }

    orderFilledString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toInfoString()}\` is triggered.`;
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

    execute(channel) {
        this.setStatus(Order.COMPLETELY_FILLED);
        channel.send(this.orderFilledString());
        orderBook.submitOrder(this.#executedOrder, channel);
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
                this.#array.splice(idx, 0, element);
                return;
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
    sellStops = new PriorityQueue(OrderBook.TIMESTAMP_COMPARATOR);;

    constructor(symbol) {
        this.#symbol = symbol;
    }

    toString() {
        let str = '';
        str += `Ticker: ${this.getSymbol()}\n`;
        str += '```\n';

        str += setW('Bids', 20) + 'Asks' + '\n';

        for(let i = 0; i < Math.max(this.bids.size(), this.asks.size()); i++) {
            if(i <= this.bids.size()-1) str += setW(this.bids.get(i).content.toDisplayBoardString(), 20);
            else str += setW('', 20);
            if(i <= this.asks.size()-1) str += this.asks.get(i).content.toDisplayBoardString();
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
                return (stop.content.getDirection() == tickDirection && currPrice < stop.content.getTriggerPrice() && stop.content.getTriggerPrice() <= newPrice);
            });
        } else {
            hitStops = this.sellStops.filter((stop) => {
                return (stop.content.getDirection() == tickDirection && newPrice <= stop.content.getTriggerPrice() && stop.content.getTriggerPrice() < currPrice);
            });
        }
        hitStops.forEach(stop => {
            this.removeStop(stop);
        });
        hitStops.forEach(stop => {
            stop.content.execute(channel);
        });
    }

    addStop(stop) {
        if(stop.content.getDirection() == Order.BUY) {
            this.buyStops.add(stop);
        } else if(stop.content.getDirection() == Order.SELL) {
            this.sellStops.add(stop);
        }
    }

    removeStop(stop) {
        if(stop.content.getDirection() == Order.BUY) {
            this.buyStops.splice(this.buyStops.indexOf(stop), 1);
        } else if(stop.content.getDirection() == Order.SELL) {
            this.sellStops.splice(this.sellStops.indexOf(stop), 1);
        }
    }
}


// Orderbook
class OrderBook {
    static #nextId = 1;
    static #getNextId() {
        return OrderBook.#nextId++;
    }
    static BIDS_COMPARATOR = function(a, b) {
        if(a.content.getPrice() == b.content.getPrice()) return a.timestamp < b.timestamp;
        return a.content.getPrice() > b.content.getPrice();
    }
    static ASKS_COMPARATOR = function(a, b) {
        if(a.content.getPrice() == b.content.getPrice()) return a.timestamp < b.timestamp;
        return a.content.getPrice() < b.content.getPrice();
    }
    static TIMESTAMP_COMPARATOR = function(a, b) {
        return a.timestamp < b.timestamp;
    }
    static VALID_TICKERS = ['CRZY', 'TAME'];

    #allOrders = new PriorityQueue(OrderBook.TIMESTAMP_COMPARATOR);
    #tickers = new Map();
    #displayBoardMessage;

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

        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            let ticker = this.#tickers.get(OrderBook.VALID_TICKERS[i]);
            let topBid = ticker.bids.peek();
            if(topBid == null) topBid = '-';
            else topBid = topBid.content.getPrice();
            let topAsk = ticker.asks.peek();
            if(topAsk == null) topAsk = '-';
            else topAsk = topAsk.content.getPrice();

            str += setW(ticker.getSymbol(), 10) + setW(ticker.getLastTradedPrice(), 10) +
            setW(topBid, 10) + setW(topAsk, 10) + '\n';
        }
        str += '```';
        return str;
    }

    getBidsDepth(ticker) {
        if(!this.hasTicker(ticker)) return 0;
        let sum = 0;
        this.getTicker(ticker).bids.forEach(bid => {
            sum += bid.content.getQuantityUnfilled();
        });
        return sum;
    }

    getAsksDepth(ticker) {
        if(!this.hasTicker(ticker)) return 0;
        let sum = 0;
        this.getTicker(ticker).asks.forEach(ask => {
            sum += ask.content.getQuantityUnfilled();
        });
        return sum;
    }

    getTicker(ticker) {
        return this.#tickers.get(ticker);
    }

    hasTicker(ticker) {
        return OrderBook.VALID_TICKERS.includes(ticker);
    }

    getOrderById(id) {
        if(!(1 <= id && id <= this.#allOrders.size())) throw new Error('Invalid id.');
        return this.#allOrders.get(id-1);
    }

    submitOrder(order, channel) {
        try {
            order.validate();
        } catch(error) {
            channel.send(error.message); return;
        }
        order = {
            id: OrderBook.#getNextId(),
            timestamp: Date.now(),
            type: order.getType(),
            content: order
        };
        order.content.setStatus(Order.NOT_FILLED);
        channel.send(order.content.orderSubmittedString());

        if(order.content instanceof LimitOrder) {
            this.#submitLimitOrder(order, channel);
        } else if(order.content instanceof MarketOrder) {
            this.#submitMarketOrder(order, channel);
        } else if(order.content instanceof StopOrder) {
            this.#submitStopOrder(order, channel);
        }
    }

    #submitLimitOrder(order, channel) {
        let ticker = this.getTicker(order.content.getTicker());
        let asks = ticker.asks;
        let bids = ticker.bids;
        let newLastTradedPrice = ticker.getLastTradedPrice();

        if(order.content.getDirection() == Order.BUY) {
            while(!asks.empty() && order.content.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = asks.peek();
                if(order.content.getPrice() < bestAsk.content.getPrice()) break;
                order.content.match(bestAsk.content);
                newLastTradedPrice = bestAsk.content.getPrice();
                if(bestAsk.content.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.content.orderFilledString());
                    asks.poll();
                }
            }
            if(order.content.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.content.orderFilledString());
            else {
                bids.add(order);
                this.#allOrders.add(order);
            }

        } else if(order.content.getDirection() == Order.SELL) {
            while(!bids.empty() && order.content.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = bids.peek();
                if(bestBid.content.getPrice() < order.content.getPrice()) break;
                order.content.match(bestBid.content);
                newLastTradedPrice = bestBid.content.getPrice();
                if(bestBid.content.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.content.orderFilledString());
                    bids.poll();
                }
            }
            if(order.content.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.content.orderFilledString());
            else {
                asks.add(order);
                this.#allOrders.add(order);
            }
        }
        ticker.setLastTradedPrice(newLastTradedPrice, channel);
        this.#updateDisplayBoard(order.content.getTicker());
    }

    #submitMarketOrder(order, channel) {
        let ticker = this.getTicker(order.content.getTicker());
        let asks = ticker.asks;
        let bids = ticker.bids;
        let newLastTradedPrice = ticker.getLastTradedPrice();

        if(order.content.getDirection() == Order.BUY) {
            if(order.content.getQuantity() > this.getAsksDepth(order.content.getTicker())) {
                this.cancelOrder(order, Order.UNFULFILLABLE, channel); return;
            }

            while(order.content.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = asks.peek();
                order.content.match(bestAsk.content);
                newLastTradedPrice = bestAsk.content.getPrice();
                if(bestAsk.content.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.content.orderFilledString());
                    asks.poll();
                }
            }

        } else if(order.content.getDirection() == Order.SELL) {
            if(order.content.getQuantity() > this.getBidsDepth(order.content.getTicker())) {
                this.cancelOrder(order, Order.UNFULFILLABLE, channel); return;
            }

            while(order.content.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = bids.peek();
                order.content.match(bestBid.content);
                newLastTradedPrice = bestBid.content.getPrice();
                if(bestBid.content.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.content.orderFilledString());
                    bids.poll();
                }
            }
        }
        channel.send(order.content.orderFilledString());
        ticker.setLastTradedPrice(newLastTradedPrice, channel);
        this.#updateDisplayBoard(order.content.getTicker());
    }

    #submitStopOrder(order, channel) {
        this.getTicker(order.content.getTicker()).addStop(order);
        this.#allOrders.add(order);
    }

    cancelOrder(order, reason, channel) {
        order.content.setStatus(Order.CANCELLED);
        channel.send(order.content.orderCancelledString(reason));
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

        case '!join':
            if(isValidTrader(msg.author)) return;

            msg.channel.send(`${getPingString(msg.author)} You've been added to the trader list.`);
            traders.set(msg.author, new Trader(msg.author));
            break;

        case '!position':
            if(!isValidTrader(msg.author)) return;

            msg.channel.send(traders.get(msg.author).toString());
            break;

        case '!buy': {
            if(!isValidTrader(msg.author)) return;

            let order;
            if(args[1] == LimitOrder.CODE) {
                order = new LimitOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), parseInt(args[4]));
            } else if(args[1] == MarketOrder.CODE) {
                order = new MarketOrder(msg.author, Order.BUY, args[2], parseInt(args[3]));
            } else if(args[1] == StopOrder.CODE) {
                if(args[4] == LimitOrder.CODE) {
                    let executedOrder = new LimitOrder(msg.author, Order.BUY, args[2], parseInt(args[5]), parseInt(args[6]));
                    order = new StopOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), executedOrder);
                } else if(args[4] == MarketOrder.CODE) {
                    let executedOrder = new MarketOrder(msg.author, Order.BUY, args[2], parseInt(args[5]));
                    order = new StopOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), executedOrder);
                } else return;
            } else return;
            orderBook.submitOrder(order, msg.channel);
            break;
        }

        case '!sell': {
            if(!isValidTrader(msg.author)) return;

            let order;
            if(args[1] == LimitOrder.CODE) {
                order = new LimitOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), parseInt(args[4]));
            } else if(args[1] == MarketOrder.CODE) {
                order = new MarketOrder(msg.author, Order.SELL, args[2], parseInt(args[3]));
            } else if(args[1] == StopOrder.CODE) {
                if(args[4] == LimitOrder.CODE) {
                    let executedOrder = new LimitOrder(msg.author, Order.SELL, args[2], parseInt(args[5]), parseInt(args[6]));
                    order = new StopOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), executedOrder);
                } else if(args[4] == MarketOrder.CODE) {
                    let executedOrder = new MarketOrder(msg.author, Order.SELL, args[2], parseInt(args[5]));
                    order = new StopOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), executedOrder);
                } else return;
            } else return;
            orderBook.submitOrder(order, msg.channel);
            break;
        }
    }
});

client.on('debug', console.log);

client.login(process.env['BOT_TOKEN']);

// Utility functions
function getPingString(user) {
    return `<@${user.id}>`;
}

function setW(value, length) {
    value = String(value);
    return value + ' '.repeat(Math.max(length - value.length, 0));
}
