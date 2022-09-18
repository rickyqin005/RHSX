const { Trader } = require('../../rhsx');

module.exports = {
	execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        interaction.editReply(await trader.positionEmbed());
	}
};