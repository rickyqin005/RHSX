require('dotenv').config();
// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// Discord
const { Client, Intents } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const { Tools } = require('./rhsx');
const interactionList = [];
const interactionHandler = async function () {
    while(interactionList.length > 0) {
        const startTime = new Date();
        const interaction = interactionList.splice(0, 1)[0];
        const mongoSession = global.mongoClient.startSession();
        let path = `./commands/${interaction.commandName}`;
        if(interaction.options.getSubcommandGroup(false) != null) path += `/${interaction.options.getSubcommandGroup()}`;
        if(interaction.options.getSubcommand(false) != null) path += `/${interaction.options.getSubcommand()}`;
        await mongoSession.withTransaction(async () => {
            try {
                await require(path).execute(interaction, mongoSession);
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
    await interaction.deferReply();
    interactionList.push(interaction);
});

async function run() {
    await global.mongoClient.connect();
    console.log('Connected to MongoDB');
    await global.discordClient.login(process.env['BOT_TOKEN']);
    console.log(`${global.discordClient.user.tag} is logged in`);
    await require('./actions/deploy_commands').run();
    await require('./actions/deploy_api').run();
    interactionHandler();
}
run();