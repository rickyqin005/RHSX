const { Client, Intents } = require('discord.js');
const { Trader, Price, Tools } = require('../rhsx');

const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
let message;
const REFRESH_RATE = 2000;

async function update() {
    await message.edit(await leaderBoardString());
    setTimeout(update, REFRESH_RATE);
}

async function leaderBoardString() {
    let str = '';
    str += `Last updated at ${Tools.dateStr(new Date())}\n`;
    str += '```\n';
    str += Tools.setW('Username', 20) + Tools.setW('Account Value', 10) + '\n';
    const traders = await Trader.queryTraders({}, {});
    for(const trader of traders) {
        str += Tools.setW((await trader.getDiscordUser()).tag, 20) +
        Tools.setW(Price.format(await trader.getAccountValue()), 10) + '\n';
    }
    str += '```\n';
    return str;
}

module.exports = {
    start: async function () {
        await discordClient.login(process.env['LEADERBOARD_BOT_TOKEN']);
        console.log(`${discordClient.user.tag} is logged in`);
        const channel = await discordClient.channels.fetch(process.env['LEADERBOARD_CHANNEL_ID']);
        message = await channel.messages.fetch(process.env['LEADERBOARD_MESSAGE_ID']);
        setTimeout(update, REFRESH_RATE);
    }
};
