const Order = require('./orders/Order');
const { Collection } = require('discord.js');

module.exports = class Ticker {
    static collection = global.mongoClient.db('RHSX').collection('Tickers');
    static cache = new Collection();

    static async getTicker(_id) {
        // const startTime = new Date();
        let res = this.cache.get(_id);
        if(res == undefined) {
            res = await this.collection.findOne({ _id: _id });
            if(res != null) {
                res = new Ticker(res);
                this.cache.set(_id, res);
            }
        }
        // console.log(`Ticker.getTicker(${_id}), took ${new Date()-startTime}ms`);
        return res;
    }
    static async queryTickers(query, sort) {
        // const startTime = new Date();
        let res = await this.collection.find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) {
            const resOrig = res[i];
            res[i] = this.cache.get(resOrig._id);
            if(res[i] == undefined) {
                res[i] = new Ticker(resOrig);
                this.cache.set(res[i]._id, res[i]);
            }
        }
        // console.log(`Ticker.queryTickers(${String(JSON.stringify(query)).replace(/\n/g, " ")}, ${String(JSON.stringify(sort)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
        return res;
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
