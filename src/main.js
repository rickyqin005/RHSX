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
        const interaction = interactionList.splice(0, 1)[0];
        const mongoSession = global.mongoClient.startSession();
        const path = getCommandPath(interaction);
        console.time(path);
        await mongoSession.withTransaction(async () => {
            try {
                interaction.editReply(await require(path).execute(interaction));
                const collectionClasses = [Market, Order, Ticker, Trader].filter(element => element.changedDocuments.size > 0);
                for(const { collection, changedDocuments } of collectionClasses) {
                    const writes = [];
                    for(const document of changedDocuments) {
                        writes.push({ replaceOne: {
                            filter: { _id: document._id },
                            replacement: document.toDBObject(),
                            upsert: true
                        } });
                    }
                    await collection.bulkWrite(writes, { ordered: false, session: mongoSession });
                    changedDocuments.clear();
                }
            } catch(error) {
                console.error(error);
                interaction.editReply(`Error: ${error.message}`);
                await mongoSession.abortTransaction();
            }
        });
        await mongoSession.endSession();
        console.timeEnd(path);
    }
    setTimeout(interactionHandler, 100);
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
    global.market = await new Market({ _id: 'market' }).fetchData();
    console.log(global.market);
    for(const dbClass of [Ticker, Trader, Order]) {
        console.time(dbClass.name);
        dbClass.cache.clear();
        const objects = await dbClass.collection.find().toArray();
        for(const object of objects) dbClass.cache.set(object._id, dbClass.assignOrderType(object));
        console.timeEnd(dbClass.name);
    }
    for(const dbClass of [Ticker, Trader, Order]) {
        for(const object of dbClass.cache.values()) object.resolve();
        dbClass.initialize();
        console.log(`Cached ${dbClass.cache.size} ${dbClass.name}(s)`);
    }
    for(const dbClass of [Ticker, Trader, Order]) {
        for(const object of dbClass.cache.values()) console.log(object);
    }
    await require('./actions/deploy_commands').run();
    await require('./actions/deploy_api').run();
    setTimeout(interactionHandler, 0);
}
run();
