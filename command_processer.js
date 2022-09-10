require('dotenv').config();
// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// Discord
const { Client, Intents } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
global.discordClient.on('debug', console.log);

const { Tools } = require('./rhsx');
global.current = {
    interaction: null,
    order: null,
    mongoSession: null
};
const interactionList = [];
const interactionHandler = async function () {
    if(interactionList.length > 0) {
        const startTime = new Date();
        const interaction = interactionList[0];
        interactionList.splice(0, 1);
        global.current = {
            interaction: interaction,
            order: null,
            mongoSession: global.mongoClient.startSession()
        }
        let path = `./commands/${interaction.commandName}`;
        if(interaction.options.getSubcommandGroup(false) != null) path += `/${interaction.options.getSubcommandGroup()}`;
        if(interaction.options.getSubcommand(false) != null) path += `/${interaction.options.getSubcommand()}`;
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
        console.log(`finished processing command ${path} at ${Tools.dateStr(new Date())}, took ${new Date()-startTime}ms`);
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
    interactionHandler();
}
run();