require('dotenv').config();

// Discord
const { Client, Intents } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Local Modules
const { Trader, Ticker, Price, Tools } = require('./rhsx');

const orderBook = new class {
    displayBoardMessage;
    leaderBoardMessage;
    startUpTime;

    async initialize() {
        this.displayBoardMessage = await CHANNEL.DISPLAY_BOARD.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        this.leaderBoardMessage = await CHANNEL.LEADERBOARD.messages.fetch(process.env['LEADERBOARD_MESSAGE_ID']);
        this.startUpTime = new Date();
        setTimeout(orderBook.updateDisplayBoard, 3000);
    }

    async updateDisplayBoard() {
        await orderBook.displayBoardMessage.edit(await orderBook.toDisplayBoardString());
        setTimeout(orderBook.updateLeaderBoard, 3000);
    }

    async updateLeaderBoard() {
        await orderBook.leaderBoardMessage.edit(await orderBook.toLeaderBoardString());
        setTimeout(orderBook.updateDisplayBoard, 3000);
    }

    async toDisplayBoardString() {
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

    async toLeaderBoardString() {
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
}();

global.current = {
    interaction: null,
    order: null,
    mongoSession: null
};
const interactionList = [];
const interactionHandler = async function () {
    if(interactionList.length > 0) {
        const interaction = interactionList[0];
        interactionList.splice(0, 1);
        console.log(`started processing interaction ${interaction.id}`);
        global.current = {
            interaction: interaction,
            order: null,
            mongoSession: global.mongoClient.startSession()
        }
        let path = `./commands/${interaction.commandName}`;
        if(interaction.options.getSubcommandGroup(false) != null) path += `/${interaction.options.getSubcommandGroup()}`;
        if(interaction.options.getSubcommand(false) != null) path += `/${interaction.options.getSubcommand()}`;
        console.log(path);
        await global.current.mongoSession.withTransaction(async session => {
            try {
                await require(path).execute(interaction);
            } catch(error) {
                console.log(error);
                interaction.editReply(`Error: ${error.message}`);
                await global.current.mongoSession.abortTransaction();
            }
        });
        await global.current.mongoSession.endSession();
        global.current = {
            interaction: null,
            order: null,
            mongoSession: null
        };
        console.log(`finished processing interaction ${interaction.id}`);
    }
    setTimeout(interactionHandler, 200);
}
global.discordClient.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return;
    console.log(`received interaction ${interaction.id}`);
    await interaction.deferReply();
    interactionList.push(interaction);
});
global.discordClient.on('debug', console.log);
// global.discordClient.on('apiRequest', () => console.log('api request'));
// global.discordClient.on('apiResponse', () => console.log('api response'));

const CHANNEL = {};
async function run() {
    await global.mongoClient.connect();
    console.log(`Connected to MongoDB!`);
    await global.discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord!`);
    CHANNEL.DISPLAY_BOARD = await global.discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
    CHANNEL.LEADERBOARD = await global.discordClient.channels.fetch(process.env['LEADERBOARD_CHANNEL_ID']);
    await orderBook.initialize();
    await require('./deploy_commands').initialize();
    interactionHandler();
}
run();
