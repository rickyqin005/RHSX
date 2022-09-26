const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('open')
        .setDescription('Opens the market (Admin only)'),
    ephemeral: false,
    execute: async function (interaction) {
        global.market.open();
        return { content: 'Market is now open' };
    }
};
