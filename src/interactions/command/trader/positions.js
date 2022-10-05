const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('positions')
        .setDescription('View your positions'),
    ephemeral: true,
    writesToDB: false,
    hasInteractiveMessage: false,

    execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        return { embeds: [await trader.positionEmbed()] };
    }
};
