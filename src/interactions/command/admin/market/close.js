const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('close')
        .setDescription('Closes the market (Admin only)'),
    ephemeral: false,
    writesToDB: true,
    hasInteractiveMessage: false,

    execute: async function (interaction) {
        global.market.close();
        return { content: 'Market is now closed' };
    }
};
