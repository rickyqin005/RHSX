module.exports = {
	execute: async function (interaction, mongoSession) {
        await global.market.open(mongoSession);
        interaction.editReply('Market is now open');
	}
};
