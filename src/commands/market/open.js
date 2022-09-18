const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	execute: async function (interaction, mongoSession) {
        await global.market.open();
        interaction.editReply('Market is now open');
	}
};
