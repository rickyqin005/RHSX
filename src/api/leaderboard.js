const { Trader, Price } = require('../rhsx');

module.exports = {
    getJSON: async function () {
        const res = {
            timestamp: new Date(),
            traders: []
        };
        const traders = await Trader.queryTraders({}, {});
        for(const trader of traders) {
            res.traders.push({
                username: (await trader.getDiscordUser()).tag,
                accountValue: Price.format(await trader.getAccountValue())
            });
        }
        return res;
    }
};
