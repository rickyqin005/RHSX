require('dotenv').config();
// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// Discord
const { Client, Intents } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
global.discordClient.on('debug', console.log);

const { Trader, Price, Tools } = require('./rhsx');
let message;
const REFRESH_RATE = 6000;
global.current = {
    mongoSession: null
};

async function update() {
    const startTime = new Date();
    global.current.mongoSession = global.mongoClient.startSession();
    await message.edit(await leaderBoardString());
    await global.current.mongoSession.endSession();
    console.log(`updated leaderboard at ${Tools.dateStr(new Date())}, took ${new Date()-startTime}ms`);
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

async function run() {
    await global.mongoClient.connect();
    console.log('Connected to MongoDB');
    await global.discordClient.login(process.env['LEADERBOARD_BOT_TOKEN']);
    console.log(`${global.discordClient.user.tag} is logged in`);
    const channel = await global.discordClient.channels.fetch(process.env['LEADERBOARD_CHANNEL_ID']);
    message = await channel.messages.fetch(process.env['LEADERBOARD_MESSAGE_ID']);
    setTimeout(update, REFRESH_RATE);
}
run();