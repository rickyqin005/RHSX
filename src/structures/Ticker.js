const Order = require('./orders/Order');
const { Collection } = require('discord.js');

module.exports = class Ticker {
    static ERROR = {
        INVALID_TICKER: new Error('Invalid ticker')
    };
    static collection = global.mongoClient.db('RHSX').collection('Tickers');
    static cache = new Collection();

    static async load() {
        const startTime = new Date();
        this.cache.clear();
        (await this.collection.find({}).toArray()).forEach(ticker => {
            this.cache.set(ticker._id, new Ticker(ticker));
        });
        console.log(`Cached ${this.cache.size} Ticker(s), took ${new Date()-startTime}ms`);
    }

    static getTicker(_id) {
        const res = this.cache.get(_id);
        if(res == undefined) throw this.ERROR.INVALID_TICKER;
        return res;
    }

    static getTickers(query, sort) {
        return Array.from(this.cache.values());
    }

    constructor(args) {
        this._id = args._id;
        this.lastTradedPrice = args.lastTradedPrice;
        this.volume = args.volume;
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

    async increaseVolume(quantity, mongoSession) {
        await Ticker.collection.updateOne({ _id: this._id }, { $inc: { volume: quantity } }, { session: mongoSession });
        this.volume += quantity;
    }

    async setLastTradedPrice(newPrice, mongoSession) {
        if(this.lastTradedPrice == newPrice) return;
        const currPrice = this.lastTradedPrice;

        await Ticker.collection.updateOne({ _id: this._id }, { $set: { lastTradedPrice: newPrice } }, { session: mongoSession });
        this.lastTradedPrice = newPrice;

        let tickDirection = ((currPrice < newPrice) ? Order.BUY : Order.SELL);
        const StopOrder = require('./orders/StopOrder');
        let triggeredStops = await Order.queryOrders({
            direction: tickDirection,
            ticker: this._id,
            type: StopOrder.TYPE,
            triggerPrice: { $gte: Math.min(currPrice, newPrice), $lte: Math.max(currPrice, newPrice) },
            status: Order.NOT_FILLED
        }, { timestamp: 1 });
        for(const stop of triggeredStops) {
            await stop.setStatus(Order.COMPLETELY_FILLED, mongoSession);
            await stop.executedOrder.submit(mongoSession);
        }
    }
};
