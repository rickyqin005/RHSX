const { Order, LimitOrder, Ticker } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            tickers: {}
        };
        const tickers = Ticker.getTickers();
        for(const ticker of tickers) {
            res.tickers[ticker._id] = {
                lastTradedPrice: ticker.lastTradedPrice,
                volume: ticker.volume,
                bids: null,
                asks: null
            };
        }
        const startTime = new Date();
        (await Order.collection.aggregate([
            { $match: {
                type: LimitOrder.TYPE,
                status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
            } },
            { $group: {
                _id: '$ticker',
                bids: {
                    $push: { $cond: [ { $eq: ['$direction', Order.BUY ] }, {
                        price: '$price',
                        quantity: { $subtract: ['$quantity', '$quantityFilled'] }
                    }, '$$REMOVE' ] }
                },
                asks: {
                    $push: { $cond: [ { $eq: ['$direction', Order.SELL ] }, {
                        price: '$price',
                        quantity: { $subtract: ['$quantity', '$quantityFilled'] }
                    }, '$$REMOVE' ] }
                }
            } },
            { $sort: { _id: 1 } }
        ]).toArray()).forEach(element => {
            element.bids.sort((a, b) => ((a.price == b.price) ? (a.timestamp - b.timestamp) : (b.price - a.price)));
            element.asks.sort((a, b) => ((a.price == b.price) ? (a.timestamp - b.timestamp) : (a.price - b.price)));
            res.tickers[element._id].bids = element.bids;
            res.tickers[element._id].asks = element.asks;
        });
        // console.log(`Order.collection.aggregate, took ${new Date()-startTime}ms`);
        return res;
    }
};