const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('close')
        .setDescription('Closes the market (Admin only)'),
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        await global.market.close(mongoSession);
        return { content: 'Market is now closed' };
    }
};
