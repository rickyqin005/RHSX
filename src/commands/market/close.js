module.exports = {
	execute: async function (interaction, mongoSession) {
        await global.market.close(mongoSession);
        interaction.editReply('Market is now closed');
	}
};
