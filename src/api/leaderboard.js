const { Ticker, Trader } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            market: {
                isOpen: global.market.isOpen
            },
            tickers: [],
            traders: []
        };
        const tickers = Ticker.getTickers();
        for(const ticker of tickers) {
            res.tickers.push({
                id: ticker._id,
                lastTradedPrice: ticker.lastTradedPrice,
                volume: ticker.volume
            });
        }
        const traders = Trader.getTraders();
        for(const trader of traders) {
            res.traders.push({
                id: trader._id,
                username: (await trader.getDiscordUser()).tag,
                accountValue: trader.getAccountValue(),
                positions: Array.from(trader.positions.values()).map(position => position.serialize())
            });
        }
        res.traders.sort((a, b) => (b.accountValue - a.accountValue));
        if(res.traders.length > 0) res.traders[0].rank = 1;
        let currRank = 1;
        for(let i = 1; i < res.traders.length; i++) {
            if(res.traders[i-1].accountValue != res.traders[i].accountValue) currRank = i+1;
            res.traders[i].rank = currRank;
        }
        return res;
    }
};
