const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../../rhsx');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        interaction.editReply(await trader.positionEmbed());
	}
};