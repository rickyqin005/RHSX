const { Trader } = require('../rhsx');

module.exports = {
	execute: async function (interaction, mongoSession) {
        try {
            const trader = Trader.getTrader(interaction.user.id);
            if(trader != null) throw Trader.ERROR.ALREADY_A_TRADER;
        } catch(error) {
            if(error == Trader.ERROR.NOT_A_TRADER) {
                await new Trader({
                    _id: interaction.user.id,
                    joined: new Date(),
                    positionLimit: Trader.DEFAULT_POSITION_LIMIT,
                    balance: 0,
                    positions: {}
                }).addToDB(mongoSession);
                interaction.editReply(`You're now a trader.`);
            } else throw error;
        }
	}
};