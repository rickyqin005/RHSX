const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('open')
        .setDescription('Opens the market (Admin only)'),
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        await global.market.open(mongoSession);
        return { content: 'Market is now open' };
    }
};
