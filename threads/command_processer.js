const { Client, Intents } = require('discord.js');

global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

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
        let path = `../commands/${interaction.commandName}`;
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

module.exports = {
    start: async function () {
        await global.discordClient.login(process.env['BOT_TOKEN']);
        console.log(`${global.discordClient.user.tag} is logged in`);
        await require('./actions/deploy_commands').run();
        interactionHandler();
    }
};
