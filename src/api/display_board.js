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
                bids: [],
                asks: []
            };
        }
        // const startTime = new Date();
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
        ]).toArray()).forEach(ticker => {
            ticker.bids.sort((a, b) => ((a.price == b.price) ? (a.timestamp - b.timestamp) : (b.price - a.price)));
            ticker.asks.sort((a, b) => ((a.price == b.price) ? (a.timestamp - b.timestamp) : (a.price - b.price)));
            let prevPrice = Number.MAX_SAFE_INTEGER;
            for(const bid of ticker.bids) {
                if(bid.price != prevPrice) {
                    res.tickers[ticker._id].bids.push({ price: bid.price, quantity: bid.quantity });
                    prevPrice = bid.price;
                } else {
                    const lastBid = res.tickers[ticker._id].bids[res.tickers[ticker._id].bids.length-1];
                    lastBid.quantity += bid.quantity;
                }
            }
            prevPrice = Number.MAX_SAFE_INTEGER;
            for(const ask of ticker.asks) {
                if(ask.price != prevPrice) {
                    res.tickers[ticker._id].asks.push({ price: ask.price, quantity: ask.quantity });
                    prevPrice = ask.price;
                } else {
                    const lastAsk = res.tickers[ticker._id].asks[res.tickers[ticker._id].asks.length-1];
                    lastAsk.quantity += ask.quantity;
                }
            }
        });
        // console.log(`Order.collection.aggregate, took ${new Date()-startTime}ms`);
        return res;
    }
};