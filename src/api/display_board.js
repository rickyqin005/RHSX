const { Order, LimitOrder, Ticker } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            market: {
                isOpen: global.market.isOpen
            },
            tickers: []
        };
        const tickers = Ticker.getTickers();
        for(const ticker of tickers) {
            res.tickers.push({
                id: ticker._id,
                lastTradedPrice: ticker.lastTradedPrice,
                volume: ticker.volume,
                bids: [],
                asks: []
            });
        }
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
                    res.tickers.find(element => element.id == ticker._id).bids.push({
                        price: bid.price,
                        quantity: bid.quantity
                    });
                    prevPrice = bid.price;
                } else {
                    const lastBid = res.tickers.find(element => element.id == ticker._id).bids.at(-1);
                    lastBid.quantity += bid.quantity;
                }
            }
            prevPrice = Number.MAX_SAFE_INTEGER;
            for(const ask of ticker.asks) {
                if(ask.price != prevPrice) {
                    res.tickers.find(element => element.id == ticker._id).asks.push({
                        price: ask.price,
                        quantity: ask.quantity
                    });
                    prevPrice = ask.price;
                } else {
                    const lastAsk = res.tickers.find(element => element.id == ticker._id).asks.at(-1);
                    lastAsk.quantity += ask.quantity;
                }
            }
        });
        return res;
    }
};