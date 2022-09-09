const { Client, Intents } = require('discord.js');
const { Ticker, Price, Tools } = require('../rhsx');

const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
let message;

async function update() {
    await message.edit(await displayBoardString());
    setTimeout(update, 1000);
}

async function displayBoardString() {
    let str = `Last updated at ${Tools.dateStr(new Date())}\n`;
    str += '```\n';
    str += Tools.setW('Ticker', 10) + Tools.setW('Price', 10) + Tools.setW('Bid', 10) + Tools.setW('Ask', 10) + Tools.setW('Volume', 10) + '\n';
    const tickers = await Ticker.queryTickers({});
    for(const ticker of tickers) {
        let topBid = (await ticker.getBids())[0];
        if(topBid != undefined) topBid = topBid.price;
        let topAsk = (await ticker.getAsks())[0];
        if(topAsk != undefined) topAsk = topAsk.price;
        str += Tools.setW(ticker._id, 10) + Tools.setW(Price.format(ticker.lastTradedPrice), 10) +
        Tools.setW(Price.format(topBid), 10) + Tools.setW(Price.format(topAsk), 10) + Tools.setW(ticker.volume, 10) + '\n';
    }
    str += '```\n';

    for(const ticker of tickers) {
        str += `Ticker: ${ticker._id}\n`;
        str += '```\n';
        str += Tools.setW('Bids', 15) + 'Asks' + '\n';
        let bids = await ticker.getBids();
        let asks = await ticker.getAsks();
        for(let i = 0; i < Math.max(bids.length, asks.length); i++) {
            if(i < bids.length) str += Tools.setW(bids[i].toDisplayBoardString(), 15);
            else str += Tools.setW('', 15);
            if(i < asks.length) str += asks[i].toDisplayBoardString();
            str += '\n';
        }
        str += '```\n';
    }
    return str;
}

module.exports = {
    start: async function () {
        await discordClient.login(process.env['DISPLAY_BOARD_BOT_TOKEN']);
        console.log(`${discordClient.user.tag} is logged in`);
        const channel = await discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
        message = await channel.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        setTimeout(update, 1000);
    }
};
