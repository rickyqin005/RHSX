const startUpTime = new Date();
require('dotenv').config();
// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// Discord
const { Client, Intents } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const { Market, Order, Ticker, Trader, Tools } = require('./rhsx');
const interactionList = [];

function getCommandPath(interaction) {
    let path = `./commands/${interaction.commandName}`;
    if(interaction.options.getSubcommandGroup(false) != null) path += `/${interaction.options.getSubcommandGroup()}`;
    if(interaction.options.getSubcommand(false) != null) path += `/${interaction.options.getSubcommand()}`;
    return path;
}

const interactionHandler = async function () {
    while(interactionList.length > 0) {
        const startTime = new Date();
        const interaction = interactionList.splice(0, 1)[0];
        const mongoSession = global.mongoClient.startSession();
        const path = getCommandPath(interaction);
        await mongoSession.withTransaction(async () => {
            try {
                interaction.editReply(await require(path).execute(interaction, mongoSession));
            } catch(error) {
                console.log(error);
                interaction.editReply(`Error: ${error.message}`);
                await mongoSession.abortTransaction();
            }
        });
        await mongoSession.endSession();
        console.log(`${path}, ${Tools.dateStr(new Date())}, took ${new Date()-startTime}ms`);
    }
    setTimeout(interactionHandler, 200);
}

global.discordClient.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return;
    const command = require(getCommandPath(interaction));
    await interaction.deferReply({ ephemeral: command.ephemeral });
    interactionList.push(interaction);
});

async function run() {
    console.log(`Starting up at ${Tools.dateStr(startUpTime)}`);
    await global.mongoClient.connect();
    console.log('Connected to MongoDB');
    await global.discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord as ${global.discordClient.user.tag}`);
    global.market = await new Market().initialize();
    console.log(global.market);
    await Ticker.load();
    await Trader.load();
    await Order.load();
    await require('./actions/deploy_commands').run();
    await require('./actions/deploy_api').run();
    setTimeout(interactionHandler, 0);
}
run();
