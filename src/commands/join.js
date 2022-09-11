const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../rhsx');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader != null) throw new Error('Already a trader');
        const session = global.current.mongoSession;
        await Trader.collection.insertOne(new Trader({
            _id: interaction.user.id,
            joined: new Date(),
            positionLimit: Trader.DEFAULT_POSITION_LIMIT,
            balance: 0,
            positions: {}
        }), { session });
        interaction.editReply(`You're now a trader.`);
	}
};