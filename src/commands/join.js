const { Trader } = require('../rhsx');

module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        try {
            const trader = Trader.getTrader(interaction.user.id);
            throw Trader.ERROR.ALREADY_A_TRADER;
        } catch(error) {
            if(error == Trader.ERROR.NOT_A_TRADER) {
                await new Trader({
                    _id: interaction.user.id,
                    joined: new Date(),
                    positionLimit: Trader.DEFAULT_POSITION_LIMIT,
                    balance: 0,
                    positions: {}
                }).addToDB(mongoSession);
                return { content: 'You\'re now a trader.' };
            } else throw error;
        }
    }
};
