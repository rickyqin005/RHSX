const Order = require('./orders/Order');
const { Collection } = require('discord.js');
const { ObjectId } = require('mongodb');

module.exports = class Ticker {
    static ERROR = {
        INVALID_TICKER: new Error('Invalid ticker')
    };
    static collection = global.mongoClient.db('RHSX').collection('Tickers');
    static changedDocuments = new Set();
    static cache = new Collection();

    static async load() {
        const startTime = new Date();
        this.cache.clear();
        (await this.collection.find().toArray()).forEach(ticker => {
            this.cache.set(ticker._id, new Ticker(ticker));
        });
        console.log(`Cached ${this.cache.size} Ticker(s), took ${new Date()-startTime}ms`);
    }

    static getTicker(_id) {
        const res = this.cache.get(_id);
        if(res == undefined) throw this.ERROR.INVALID_TICKER;
        return res;
    }

    static getTickers() {
        return Array.from(this.cache.values());
    }

    constructor(args) {
        this._id = args._id ?? ObjectId();
        this.lastTradedPrice = args.lastTradedPrice;
        this.volume = args.volume ?? 0;
    }

    toString() {
        return this._id;
    }

    async getBids() {
        const LimitOrder = require('./orders/LimitOrder');
        return await Order.queryOrders({
            direction: Order.BUY,
            ticker: this._id,
            type: LimitOrder.TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: -1, timestamp: 1 });
    }

    async getAsks() {
        const LimitOrder = require('./orders/LimitOrder');
        return await Order.queryOrders({
            direction: Order.SELL,
            ticker: this._id,
            type: LimitOrder.TYPE,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { price: 1, timestamp: 1 });
    }

    toDBObject() {
        const obj = new Ticker(this);
        return obj;
    }

    async increaseVolume(quantity, mongoSession) {
        this.volume += quantity;
        Ticker.changedDocuments.add(this);
    }

    async setLastTradedPrice(newPrice, mongoSession) {
        if(this.lastTradedPrice == newPrice) return;
        const currPrice = this.lastTradedPrice;
        this.lastTradedPrice = newPrice;
        Ticker.changedDocuments.add(this);

        const tickDirection = ((currPrice < newPrice) ? Order.BUY : Order.SELL);
        const StopOrder = require('./orders/StopOrder');
        const triggeredStops = await Order.queryOrders({
            direction: tickDirection,
            ticker: this._id,
            type: StopOrder.TYPE,
            triggerPrice: { $gte: Math.min(currPrice, newPrice), $lte: Math.max(currPrice, newPrice) },
            status: Order.NOT_FILLED
        }, { timestamp: 1 });
        for(const stop of triggeredStops) {
            await stop.setStatus(Order.COMPLETELY_FILLED, mongoSession);
            await stop.executedOrder.submit(false, mongoSession);
        }
    }
};
