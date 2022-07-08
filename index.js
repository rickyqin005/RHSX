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
                str += `\`${this.#orders[i].toShortString()}\`` + '\n';
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
    static NOT_FILLED = 0;
    static PARTIALLY_FILLED = 1;
    static COMPLETELY_FILLED = 2;
    static UNFULFILLABLE = 0;
    static VIOLATES_POSITION_LIMITS = 1;

    #user;
    #direction;
    #type;
    #ticker;

    constructor(user, direction, type, ticker) {
        super();
        this.#user = user;
        this.#direction = direction;
        this.#type = type;
        this.#ticker = ticker;

        traders.get(this.getUser()).addOrder(this);
    }

    toString() {
        return `Id: ${this.getId()}, User: ${this.getUser().tag}`;
    }
    toNonUserString() {
        return `Id: ${this.getId()}`;
    }
    toShortString() {
        return `Id: ${this.getId()}`;
    }
    orderSubmittedString() {
        return `${getPingString(this.getUser())} Your order: \`${this.toShortString()}\` is submitted.`;
    }
    orderFilledString() {
        return `${getPingString(this.getUser())} Your order: \`${this.toShortString()}\` is filled.`;
    }
    orderCancelledString(reason) {
        switch (reason) {
            case Order.UNFULFILLABLE:
                return `${getPingString(this.getUser())} Your order: \`${this.toShortString()}\` is cancelled because it cannot be fulfilled.`;

            case Order.VIOLATES_POSITION_LIMITS:
                return `${getPingString(this.getUser())} Your order: \`${this.toShortString()}\` is cancelled because it violates your position limits.`;

            default:
                return `${getPingString(this.getUser())} Your order: \`${this.toShortString()}\` is cancelled`;
        }
    }

    getUser() {
        return this.#user;
    }
    getDirection() {
        return this.#direction;
    }
    getType() {
        return this.#type;
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

    constructor(user, direction, type, ticker, quantity) {
        super(user, direction, type, ticker);
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
    #price;

    constructor(user, direction, ticker, quantity, price) {
        super(user, direction, 'LIMIT', ticker, quantity);
        this.#price = price;
    }

    toString() {
        return `${super.toString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} (x${this.getQuantityFilled()} filled) ${this.getTicker()} @${this.getPrice()}`;
    }
    toNonUserString() {
        return `${super.toNonUserString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} (x${this.getQuantityFilled()} filled) ${this.getTicker()} @${this.getPrice()}`;
    }
    toShortString() {
        return `${super.toShortString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()} @${this.getPrice()}`;
    }
    toStopLossString() {
        return `${this.getDirection()} ${this.getType()} x${this.getQuantity()} @${this.getPrice()}`;
    }

    getPrice() {
        return this.#price;
    }
}

class MarketOrder extends NormalOrder {

    constructor(user, direction, ticker, quantity) {
        super(user, direction, 'MARKET', ticker, quantity);
    }

    toString() {
        return `${super.toString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()}`;
    }
    toNonUserString() {
        return `${super.toNonUserString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()}`;
    }
    toShortString() {
        return `${super.toShortString()}, ${this.getDirection()} ${this.getType()} x${this.getQuantity()} ${this.getTicker()}`;
    }
    toStopLossString() {
        return `${this.getDirection()} ${this.getType()} x${this.getQuantity()}`;
    }
}

class StopLossOrder extends Order {
    #triggerPrice;
    #executedOrder;
    #isExecuted;

    constructor(user, direction, ticker, triggerPrice, executedOrder) {
        super(user, direction, 'STOPLOSS', ticker);
        this.#triggerPrice = triggerPrice;
        this.#executedOrder = executedOrder;
        this.#isExecuted = false;
    }

    toString() {
        return `${super.toString()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopLossString()}`;
    }
    toNonUserString() {
        return `${super.toNonUserString()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopLossString()}`;
    }
    toShortString() {
        return `${super.toShortString()}, ${this.#executedOrder.getTicker()} @${this.getTriggerPrice()}, ${this.#executedOrder.toStopLossString()}`;
    }
    orderExecutedString() {
        return `${getPingString(this.getUser())} Your stop order: \`${this.toShortString()}\` is triggered.`;
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

    forEach(funct) {
        this.#array.forEach(funct);
    }

    // prints all the elements in order of the priority queue
    printAll() {
        if(this.#array.length == 0) {
            return 'None.' + '\n';
        }

        let str = '';
        for(let i = 0; i < this.#array.length; i++) {
            str += this.#array[i].toString() + '\n';
        }
        return str;
    }

    // prints all the elements in reverse order of the priority queue
    printAllReverse() {
        if(this.#array.length == 0) {
            return 'None.' + '\n';
        }

        let str = '';
        for(let i = this.#array.length-1; i >= 0; i--) {
            str += this.#array[i].toString() + '\n';
        }
        return str;
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

    constructor(symbol, infoMessageChannel, infoMessageId) {
        this.#symbol = symbol;
        this.#infoMessage = await infoMessageChannel.messages.fetch(infoMessageId);
        this.#infoMessage.edit('edited message');
        this.#lastTradedPrice = Ticker.#DEFAULT_STARTING_PRICE;
        this.bids = new PriorityQueue(OrderBook.BIDS_COMPARATOR);
        this.asks = new PriorityQueue(OrderBook.ASKS_COMPARATOR);
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
        if(currPrice < newPrice) tickDirection = 'BUY';
        else tickDirection = 'SELL';

        for(let i = 0; i < this.#stops.length; i++) {
            if(this.#stops[i].getDirection() == 'BUY' && tickDirection == 'BUY') {
                if(currPrice < this.#stops[i].getTriggerPrice() && this.#stops[i].getTriggerPrice() <= newPrice) {
                    let stop = this.#stops[i];
                    this.#stops.splice(i, 1); i--;
                    stop.execute(channel);
                }
            } else if(this.#stops[i].getDirection() == 'SELL' && tickDirection == 'SELL') {
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
    static getTickerListString() {
        let str = '```' + '\n';
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            str += OrderBook.VALID_TICKERS[i] + '\n';
        }
        str += '```';

        return str;
    }

    #tickers = new Map();

    constructor(channel) {
        let messageIds = JSON.parse(process.env['STOCK_INFO_MESSAGE_IDS']);
        for(let i = 0; i < OrderBook.VALID_TICKERS.length; i++) {
            this.#tickers.set(OrderBook.VALID_TICKERS[i], new Ticker(OrderBook.VALID_TICKERS[i], channel, messageIds[i]));
        }
    }

    toString(ticker) {
        if(!this.hasTicker(ticker)) return 'Invalid ticker.';

        let str = '';
        str += 'Bids:' + '\n';
        // str += `Order depth: ${this.getBidsDepth(ticker)}` + '\n';
        str += '```';
        str += this.#getTicker(ticker).bids.printAllReverse();
        str += '```';
        str += '\n';

        str += 'Asks:' + '\n';
        // str += `Order depth: ${this.getAsksDepth(ticker)}` + '\n';
        str += '```';
        str += this.#getTicker(ticker).asks.printAll();
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

        if(order.getDirection() == 'BUY') {
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

        } else if(order.getDirection() == 'SELL') {
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
    }

    submitMarketOrder(order, channel) {
        if(!this.#validateOrder(order, channel)) return;
        channel.send(order.orderSubmittedString());

        let ticker = this.#getTicker(order.getTicker());
        let asks = ticker.asks;
        let bids = ticker.bids;
        let newLastTradedPrice = ticker.getLastTradedPrice();

        if(order.getDirection() == 'BUY') {
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

        } else if(order.getDirection() == 'SELL') {
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
    }

    submitStopLossOrder(order, channel) {
        if(!this.#validateOrder(order, channel)) return;
        channel.send(order.orderSubmittedString());

        this.#getTicker(order.getTicker()).addStop(order);
    }
}
let orderBook;

client.once('ready', c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});
client.on('ready', () => {
    client.channels.fetch(process.env['STOCK_INFO_CHANNEL_ID'])
        .then(channel => {
            orderBook = new OrderBook(channel);
        });
});

client.on('messageCreate', (msg) => {
    if(msg.author == process.env['BOT_ID']) return;

    let args = msg.content.split(' ');

    switch(args[0]) {
        case '!help': {
            let infoString =
                '!help' + '\n' +
                '!join' + '\n' +
                // '!position' + '\n' +
                '!tradehistory' + '\n' +
                '!buy LIMIT [ticker] [quantity] [price]' + '\n' +
                '!sell LIMIT [ticker] [quantity] [price]' + '\n' +
                '!buy MARKET [ticker] [quantity]' + '\n' +
                '!sell MARKET [ticker] [quantity]' + '\n' +
                '!buy STOPLOSS [ticker] [trigger price] [order type] [quantity] [[price]]' + '\n' +
                '!sell STOPLOSS [ticker] [trigger price] [order type] [quantity] [[price]]' + '\n' +
                '!orderbook [ticker]' + '\n' +
                '!tickerlist';

            msg.channel.send('```' + infoString + '```');
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
                case 'LIMIT': {
                    let order = new LimitOrder(msg.author, 'BUY', args[2], parseInt(args[3]), parseInt(args[4]));
                    orderBook.submitLimitOrder(order, msg.channel);
                    break;
                }
                case 'MARKET': {
                    let order = new MarketOrder(msg.author, 'BUY', args[2], parseInt(args[3]));
                    orderBook.submitMarketOrder(order, msg.channel);
                    break;
                }
                case 'STOPLOSS': {
                    switch (args[4]) {
                        case 'LIMIT': {
                            let executedOrder = new LimitOrder(msg.author, 'BUY', args[2], args[5], args[6]);
                            let order = new StopLossOrder(msg.author, 'BUY', args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopLossOrder(order, msg.channel);
                            break;
                        }
                        case 'MARKET': {
                            let executedOrder = new MarketOrder(msg.author, 'BUY', args[2], args[5]);
                            let order = new StopLossOrder(msg.author, 'BUY', args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopLossOrder(order, msg.channel);
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
                case 'LIMIT': {
                    let order = new LimitOrder(msg.author, 'SELL', args[2], parseInt(args[3]), parseInt(args[4]));
                    orderBook.submitLimitOrder(order, msg.channel);
                    break;
                }
                case 'MARKET': {
                    let order = new MarketOrder(msg.author, 'SELL', args[2], parseInt(args[3]));
                    orderBook.submitMarketOrder(order, msg.channel);
                    break;
                }
                case 'STOPLOSS': {
                    switch (args[4]) {
                        case 'LIMIT': {
                            let executedOrder = new LimitOrder(msg.author, 'SELL', args[2], args[5], args[6]);
                            let order = new StopLossOrder(msg.author, 'SELL', args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopLossOrder(order, msg.channel);
                            break;
                        }
                        case 'MARKET': {
                            let executedOrder = new MarketOrder(msg.author, 'SELL', args[2], args[5]);
                            let order = new StopLossOrder(msg.author, 'SELL', args[2], parseInt(args[3]), executedOrder);
                            orderBook.submitStopLossOrder(order, msg.channel);
                            break;
                        }
                    }
                }
            }
            break;
        }

        case '!orderbook':
            if(!isValidTrader(msg.author)) return;

            msg.channel.send(orderBook.toString(args[1]));
            break;

        case '!tickerlist':
            if(!isValidTrader(msg.author)) return;

            msg.channel.send(OrderBook.getTickerListString());
            break;

    }
});

client.on('debug', console.log);

client.login(process.env['BOT_TOKEN']);

// Utility functions
function getPingString(user) {
    return `<@${user.id}>`;
}
