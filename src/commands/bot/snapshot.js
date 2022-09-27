const { Order, Ticker, Trader } = require('../../rhsx');
const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('snapshot')
        .setDescription('Returns the objects currently stored in the bot\'s cache'),
    ephemeral: true,
    execute: async function (interaction) {
        const obj = {
            timestamp: new Date(),
            market: global.market,
            tickers: Array.from(Ticker.cache.values()).map(ticker => ticker.toDBObject()),
            traders: Array.from(Trader.cache.values()).map(trader => trader.toDBObject()),
            orders: Array.from(Order.cache.values()).map(order => order.toDBObject())
        }
        const fileDir = path.join(__dirname, '../../../storage/snapshot.json');
        await fs.writeFile(fileDir, JSON.stringify(obj, undefined, 4), () => {});
        return { files: [{ attachment: fileDir, name: 'snapshot.json' }] };
    }
};
