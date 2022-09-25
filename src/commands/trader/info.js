const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('View general account info'),
    ephemeral: true,
    execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        return { embeds: [await trader.infoEmbed()] };
    }
};
