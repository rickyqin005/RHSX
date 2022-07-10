// Setting up the bot
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('this is a bot'));
app.listen(port, () => console.log(`listening at port ${port}`));

// Bot
const {Client, Intents} = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]});

// Traders
const traders = new Map();

function isValidTrader(user) {
    return (traders.get(user) != undefined);
}

class Trader {
    static #DEFAULT_POSITION_LIMIT = 100000;
    #user;
    #positionLimit;
    #orders = [];

    constructor(user) {
        this.#user = user;
        this.#positionLimit = Trader.#DEFAULT_POSITION_LIMIT;
    }

    toString() {
        let str = '';
        str += `Pending Orders:` + '\n';
        let pendingOrdersCount = 0;
        for(let i = 0; i < this.#orders.length; i++) {
            if(this.#orders[i].getStatus() != Order.COMPLETELY_FILLED) {
                str += `\`${this.#orders[i].toNonUserString()}\`` + '\n';
                pendingOrdersCount++;
            }
        }
        if(pendingOrdersCount == 0) str += '`None`';
        return str;
    }

    getTradeHistoryString() {
        let str = '';
        let tradeCount = 0;
        for(let i = 0; i < this.#orders.length; i++) {
            if(this.#orders[i].getStatus() == Order.COMPLETELY_FILLED) {
                str += `\`${this.#orders[i].toFullString()}\`` + '\n';
                tradeCount++;
            }
        }
        if(tradeCount == 0) str += '`Empty`';
        return str;
    }

    getUser() {
        return this.#user;
    }

    addOrder(order) {
        this.#orders.push(order);
    }
    removeOrder(order) {
        this.#orders.splice(this.#orders.indexOf(order), 1);
    }
}

// Orders
class MarketObject {
    static #nextId = 1;
    static #getNextId() {
        return this.#nextId++;
    }

    #id;

    constructor() {
        this.#id = MarketObject.#getNextId();
    }

    getId() {
        return this.#id;
    }
}

class Order extends MarketObject {
    static TYPE = 'order';
    static BUY = 0;
    static SELL = 1;
    static NOT_FILLED = 0;
    static PARTIALLY_FILLED = 1;
    static COMPLETELY_FILLED = 2;
    static UNFULFILLABLE = 0;
    static VIOLATES_POSITION_LIMITS = 1;

    #user;
    #direction;
    #ticker;

    constructor(user, direction, ticker) {
        super();
        this.#user = user;
        this.#direction = direction;
        this.#ticker = ticker;

        traders.get(this.getUser()).addOrder(this);
    }

    toString() {
        return `#${this.getId()}`;
    }
    toFullString() {
        return `#${this.getId()}`;
    }
    orderSubmittedString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is submitted.`;
    }
    orderFilledString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is filled.`;
    }
    orderCancelledString(reason) {
        switch (reason) {
            case Order.UNFULFILLABLE:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is cancelled because it cannot be fulfilled.`;

            case Order.VIOLATES_POSITION_LIMITS:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is cancelled because it violates your position limits.`;

            default:
                return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is cancelled`;
        }
    }

    getType() {
        return Order.TYPE;
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

    cancel(reason, channel) {
        traders.get(this.getUser()).removeOrder(this);
        channel.send(this.orderCancelledString(reason));
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

    getQuantity() {
        return this.#quantity;
    }
    getQuantityFilled() {
        return this.#quantityFilled;
    }
    getQuantityUnfilled() {
        return this.#quantity - this.#quantityFilled;
    }

    getStatus() {
        if(this.#quantityFilled == 0) return Order.NOT_FILLED;
        else if(this.#quantityFilled < this.#quantity) return Order.PARTIALLY_FILLED;
        else if(this.#quantityFilled == this.#quantity) return Order.COMPLETELY_FILLED;
    }

    match(existingOrder) {
        let quantityTradable = Math.min(this.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        this.#increaseQuantityFilled(quantityTradable);
        existingOrder.#increaseQuantityFilled(quantityTradable);
    }

    #increaseQuantityFilled(amount) {
        this.#quantityFilled += amount;
        return this.getStatus();
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

    toString() {
        return `${super.toString()}, x${this.getQuantity()} (x${this.getQuantityFilled()} filled) @${this.getPrice()}`;
    }
    toFullString() {
        return `${super.toFullString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()} @${this.getPrice()}`;
    }
    toStopString() {
        return `${this.getDirection()} ${this.getType()} x${this.getQuantity()} @${this.getPrice()}`;
    }

    getType() {
        return LimitOrder.TYPE;
    }
    getPrice() {
        return this.#price;
    }
}

class MarketOrder extends NormalOrder {
    static TYPE = 'market order';
    static CODE = 'MARKET';

    constructor(user, direction, ticker, quantity) {
        super(user, direction, ticker, quantity);
    }

    toString() {
        return `${super.toString()}, x${this.getQuantity()}`;
    }
    toFullString() {
        return `${super.toFullString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()}`;
    }
    toStopString() {
        return `${this.getDirection()} ${this.getType()} x${this.getQuantity()}`;
    }

    getType() {
        return MarketOrder.TYPE;
    }
}

class StopOrder extends Order {
    static TYPE = 'stop order';
    static CODE = 'STOP';

    #triggerPrice;
    #executedOrder;
    #isExecuted;

    constructor(user, direction, ticker, triggerPrice, executedOrder) {
        super(user, direction, ticker);
        this.#triggerPrice = triggerPrice;
        this.#executedOrder = executedOrder;
        this.#isExecuted = false;
    }

    toString() {
        return `${super.toString()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopLossString()}`;
    }
    toFullString() {
        return `${super.toFullString()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopLossString()}`;
    }
    orderExecutedString() {
        return `${getPingString(this.getUser())} Your ${this.getType()}: \`${this.toFullString()}\` is triggered.`;
    }

    getType() {
        return StopOrder.TYPE;
    }
    getTriggerPrice() {
        return this.#triggerPrice;
    }

    execute(channel) {
        channel.send(this.orderExecutedString());
        orderBook.submitOrder(this.#executedOrder, channel);
        this.#isExecuted = true;
    }

    isExecuted() {
        return this.#isExecuted;
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
        return;
    }

    peek() {
        if(this.#array.length == 0) return null;
        return this.#array[0];
    }

    poll() {
        if(this.#array.length == 0) return;
        this.#array.splice(0,1);
    }

    get(index) {
        return this.#array[index];
    }

    forEach(funct) {
        this.#array.forEach(funct);
    }
}

class Ticker {
    static #DEFAULT_STARTING_PRICE = 50;
    #symbol;
    #infoMessage;
    #lastTradedPrice;
    bids;
    asks;
    #stops = [];

    constructor(symbol) {
        this.#symbol = symbol;
        this.#lastTradedPrice = Ticker.#DEFAULT_STARTING_PRICE;
        this.bids = new PriorityQueue(OrderBook.BIDS_COMPARATOR);
        this.asks = new PriorityQueue(OrderBook.ASKS_COMPARATOR);
    }
    async initialize(infoMessageChannel, infoMessageId) {
        this.#infoMessage = await infoMessageChannel.messages.fetch(infoMessageId);
        this.refresh();
    }

    refresh() {
        this.#infoMessage.edit(this.#toString());
    }
    #toString() {
        let str = '';
        str += `Ticker: ${this.getSymbol()}` + '\n';

        str += '```' + '\n';
        str += setW('Bids', 36) + setW('Asks', 36) + '\n';

        for(let i = 0; i < Math.max(this.bids.size(), this.asks.size()); i++) {
            if(i <= this.bids.size()-1) str += setW(this.bids.get(i).toString(), 36);
            else str += setW('', 36);

            if(i <= this.asks.size()-1) str += setW(this.asks.get(i).toString(), 36);
            else str += setW('', 36);

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
        let tickDirection = '';
        if(currPrice < newPrice) tickDirection = Order.BUY;
        else tickDirection = Order.SELL;

        for(let i = 0; i < this.#stops.length; i++) {
            if(this.#stops[i].getDirection() == Order.BUY && tickDirection == Order.BUY) {
                if(currPrice < this.#stops[i].getTriggerPrice() && this.#stops[i].getTriggerPrice() <= newPrice) {
                    let stop = this.#stops[i];
                    this.#stops.splice(i, 1); i--;
                    stop.execute(channel);
                }
            } else if(this.#stops[i].getDirection() == Order.SELL && tickDirection == Order.SELL) {
                if(newPrice <= this.#stops[i].getTriggerPrice() && this.#stops[i].getTriggerPrice() < currPrice) {
                    let stop = this.#stops[i];
                    this.#stops.splice(i, 1); i--;
                    stop.execute(channel);
                }
            }
        }

        this.#lastTradedPrice = newPrice;
    }

    addStop(stop) {
        this.#stops.push(stop);
    }
}


// Orderbook
class OrderBook {
    static BIDS_COMPARATOR = function(a, b) {
        if(a.getPrice() == b.getPrice()) return a.getId() < b.getId();
        return a.getPrice() > b.getPrice();
    }
    static ASKS_COMPARATOR = function(a, b) {
        if(a.getPrice() == b.getPrice()) return a.getId() < b.getId();
        return a.getPrice() < b.getPrice();
    }
    static VALID_TICKERS = ['CRZY', 'TAME'];

    #tickers = new Map();
    #infoMessage;

    constructor() {
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            this.#tickers.set(OrderBook.VALID_TICKERS[i], new Ticker(OrderBook.VALID_TICKERS[i]));
        }
    }
    async initialize() {
        let channel = await client.channels.fetch(process.env['STOCK_INFO_CHANNEL_ID']);
        let orderBookMessageId = process.env['ORDERBOOK_MESSAGE_ID'];
        this.#infoMessage = await channel.messages.fetch(orderBookMessageId);
        this.refresh();

        let tickerMessageIds = JSON.parse(process.env['TICKER_MESSAGE_IDS']);
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            this.#tickers.get(OrderBook.VALID_TICKERS[i]).initialize(channel, tickerMessageIds[i]);
        }

    }

    refresh() {
        this.#infoMessage.edit(this.#toString());
    }
    #toString() {
        let str = '```' + '\n';

        str += setW('Ticker', 15) + setW('Price', 15) + setW('Bid', 15) + setW('Ask', 15) + '\n';

        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            let ticker = this.#tickers.get(OrderBook.VALID_TICKERS[i]);
            let topBid = ticker.bids.peek();
            if(topBid == null) topBid = '-';
            else topBid = topBid.getPrice();
            let topAsk = ticker.asks.peek();
            if(topAsk == null) topAsk = '-';
            else topAsk = topAsk.getPrice();

            str += setW(ticker.getSymbol(), 15) + setW(ticker.getLastTradedPrice(), 15) +
            setW(topBid, 15) + setW(topAsk, 15) + '\n';
        }
        str += '```';
        return str;
    }

    getBidsDepth(ticker) {
        if(!this.hasTicker(ticker)) return 0;
        let sum = 0;
        this.#getTicker(ticker).bids.forEach(bid => {
            sum += bid.getQuantityUnfilled();
        });
        return sum;
    }

    getAsksDepth(ticker) {
        if(!this.hasTicker(ticker)) return 0;
        let sum = 0;
        this.#getTicker(ticker).asks.forEach(ask => {
            sum += ask.getQuantityUnfilled();
        });
        return sum;
    }

    #getTicker(ticker) {
        return this.#tickers.get(ticker);
    }
    hasTicker(ticker) {
        return OrderBook.VALID_TICKERS.includes(ticker);
    }

    #validateOrder(order, channel) {
        if(!this.hasTicker(order.getTicker())) {
            channel.send('Invalid ticker.'); return false;
        }
        return true;
    }

    submitOrder(order, channel) {
        if(order instanceof LimitOrder) {
            this.submitLimitOrder(order, channel);
        } else if(order instanceof MarketOrder) {
            this.submitMarketOrder(order, channel);
        }
    }

    submitLimitOrder(order, channel) {
        if(!this.#validateOrder(order, channel)) return;
        channel.send(order.orderSubmittedString());

        let ticker = this.#getTicker(order.getTicker());
        let asks = ticker.asks;
        let bids = ticker.bids;
        let newLastTradedPrice = ticker.getLastTradedPrice();

        if(order.getDirection() == Order.BUY) {
            while(!asks.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = asks.peek();
                if(order.getPrice() < bestAsk.getPrice()) break;
                order.match(bestAsk);
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.orderFilledString());
                    asks.poll();
                    newLastTradedPrice = bestAsk.getPrice();
                }
            }
            if(order.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.orderFilledString());
            else bids.add(order);

        } else if(order.getDirection() == Order.SELL) {
            while(!bids.empty() && order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = bids.peek();
                if(bestBid.getPrice() < order.getPrice()) break;
                order.match(bestBid);
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.orderFilledString());
                    bids.poll();
                    newLastTradedPrice = bestBid.getPrice();
                }
            }
            if(order.getStatus() == Order.COMPLETELY_FILLED) channel.send(order.orderFilledString());
            else asks.add(order);

        }
        ticker.setLastTradedPrice(newLastTradedPrice, channel);
        this.refresh();
        this.#getTicker(order.getTicker()).refresh();
    }

    submitMarketOrder(order, channel) {
        if(!this.#validateOrder(order, channel)) return;
        channel.send(order.orderSubmittedString());

        let ticker = this.#getTicker(order.getTicker());
        let asks = ticker.asks;
        let bids = ticker.bids;
        let newLastTradedPrice = ticker.getLastTradedPrice();

        if(order.getDirection() == Order.BUY) {
            if(order.getQuantity() > this.getAsksDepth(order.getTicker())) {
                order.cancel(Order.UNFULFILLABLE, channel); return;
            }

            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestAsk = asks.peek();
                order.match(bestAsk);
                if(bestAsk.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestAsk.orderFilledString());
                    asks.poll();
                    newLastTradedPrice = bestAsk.getPrice();
                }
            }

        } else if(order.getDirection() == Order.SELL) {
            if(order.getQuantity() > this.getBidsDepth(order.getTicker())) {
                order.cancel(Order.UNFULFILLABLE, channel); return;
            }

            while(order.getStatus() != Order.COMPLETELY_FILLED) {
                let bestBid = bids.peek();
                order.match(bestBid);
                if(bestBid.getStatus() == Order.COMPLETELY_FILLED) {
                    channel.send(bestBid.orderFilledString());
                    bids.poll();
                    newLastTradedPrice = bestBid.getPrice();
                }
            }

        }
        ticker.setLastTradedPrice(newLastTradedPrice, channel);
        this.refresh();
        this.#getTicker(order.getTicker()).refresh();
    }

    submitStopOrder(order, channel) {
        if(!this.#validateOrder(order, channel)) return;
        channel.send(order.orderSubmittedString());

        this.#getTicker(order.getTicker()).addStop(order);
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
                // `!position\n` +
                `!tradehistory\n` +
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

        case '!tradehistory':
            if(!isValidTrader(msg.author)) return;

            msg.channel.send(traders.get(msg.author).getTradeHistoryString());
            break;

        case '!buy': {
            if(!isValidTrader(msg.author)) return;

            switch(args[1]) {
                case LimitOrder.CODE: {
                    let order = new LimitOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), parseInt(args[4]));
                    orderBook.submitLimitOrder(order, msg.channel);
                    break;
                }
                case MarketOrder.CODE: {
                    let order = new MarketOrder(msg.author, Order.BUY, args[2], parseInt(args[3]));
                    orderBook.submitMarketOrder(order, msg.channel);
                    break;
                }
                case StopOrder.CODE: {
                    switch (args[4]) {
                        case LimitOrder.CODE: {
                            let executedOrder = new LimitOrder(msg.author, Order.BUY, args[2], args[5], args[6]);
                            let order = new StopOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopOrder(order, msg.channel);
                            break;
                        }
                        case MarketOrder.CODE: {
                            let executedOrder = new MarketOrder(msg.author, Order.BUY, args[2], args[5]);
                            let order = new StopOrder(msg.author, Order.BUY, args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopOrder(order, msg.channel);
                            break;
                        }
                    }
                }
            }
            break;
        }

        case '!sell': {
            if(!isValidTrader(msg.author)) return;

            switch(args[1]) {
                case LimitOrder.CODE: {
                    let order = new LimitOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), parseInt(args[4]));
                    orderBook.submitLimitOrder(order, msg.channel);
                    break;
                }
                case MarketOrder.CODE: {
                    let order = new MarketOrder(msg.author, Order.SELL, args[2], parseInt(args[3]));
                    orderBook.submitMarketOrder(order, msg.channel);
                    break;
                }
                case StopOrder.CODE: {
                    switch (args[4]) {
                        case LimitOrder.CODE: {
                            let executedOrder = new LimitOrder(msg.author, Order.SELL, args[2], args[5], args[6]);
                            let order = new StopOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopOrder(order, msg.channel);
                            break;
                        }
                        case MarketOrder.CODE: {
                            let executedOrder = new MarketOrder(msg.author, Order.SELL, args[2], args[5]);
                            let order = new StopOrder(msg.author, Order.SELL, args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopOrder(order, msg.channel);
                            break;
                        }
                    }
                }
            }
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
