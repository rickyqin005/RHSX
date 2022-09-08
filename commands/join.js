const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../rhsx');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader != null) throw new Error('Already a trader');
        await Trader.collection.insertOne(new Trader({
            _id: interaction.user.id,
            positionLimit: Trader.DEFAULT_POSITION_LIMIT,
            balance: 0,
            positions: {}
        }), global.current.mongoSession);
        interaction.editReply(`You're now a trader.`);
	}
};