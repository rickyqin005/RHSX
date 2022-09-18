const { Ticker, Trader } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            marketIsOpen: global.market.isOpen,
            tickers: {},
            traders: []
        };
        const tickers = Ticker.getTickers();
        for(const ticker of tickers) {
            res.tickers[ticker._id] = {
                lastTradedPrice: ticker.lastTradedPrice,
                volume: ticker.volume
            };
        }
        const traders = await Trader.queryTraders({}, {});
        for(const trader of traders) {
            res.traders.push({
                username: (await trader.getDiscordUser()).tag,
                accountValue: await trader.getAccountValue(),
                positions: trader.positions
            });
        }
        return res;
    }
};
