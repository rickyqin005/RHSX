const { Trader } = require('../rhsx');

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
                accountValue: await trader.getAccountValue()
            });
        }
        return res;
    }
};
