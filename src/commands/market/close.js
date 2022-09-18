const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	execute: async function (interaction, mongoSession) {
        await global.market.close();
        interaction.editReply('Market is now closed');
	}
};
