const Order = require('./orders/Order');

module.exports = class Ticker {
    static collection = global.mongoClient.db('RHSX').collection('Tickers');

    static async getTicker(_id) {
        let res = await this.collection.findOne({ _id: _id }, global.current.mongoSession);
        if(res != null) res = new Ticker(res);
        return res;
    }
    static async queryTickers(query, sort) {
        let res = await this.collection.find(query, global.current.mongoSession).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = new Ticker(res[i]);
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

    async increaseVolume(quantity) {
        await Ticker.collection.updateOne({ _id: this._id }, { $inc: { volume: quantity } }, global.current.mongoSession);
        this.volume += quantity;
    }

    async setLastTradedPrice(newPrice) {
        if(this.lastTradedPrice == newPrice) return;
        const currPrice = this.lastTradedPrice;

        await Ticker.collection.updateOne({ _id: this._id }, { $set: { lastTradedPrice: newPrice } }, global.current.mongoSession);
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
            await stop.setStatus(Order.COMPLETELY_FILLED);
            await stop.executedOrder.submit();
        }
    }
};
