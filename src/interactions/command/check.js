const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('check')
        .setDescription('Check if the bot is alive'),
    ephemeral: false,
    writesToDB: false,
    hasInteractiveMessage: false,

    execute: async function (interaction) {
        return { content: `${global.discordClient.user.username} is active!` };
    }
};
