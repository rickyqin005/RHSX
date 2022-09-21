const { Trader } = require('../../rhsx');

module.exports = {
    ephemeral: true,
    execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        return { embeds: [await trader.infoEmbed()] };
    }
};
