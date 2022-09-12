const { Ticker, Price } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            tickers: {}
        };
        const tickers = await Ticker.queryTickers({});
        for(const ticker of tickers) {
            res.tickers[ticker._id] = {
                _id: ticker._id,
                lastTradedPrice: Price.format(ticker.lastTradedPrice),
                volume: ticker.volume,
                bids: [],
                asks: []
            };
            const bids = await ticker.getBids();
            const asks = await ticker.getAsks();
            bids.forEach((bid) => res.tickers[ticker._id].bids.push(bid.toDisplayBoardString()));
            asks.forEach((ask) => res.tickers[ticker._id].asks.push(ask.toDisplayBoardString()));
        }
        return res;
    }
};