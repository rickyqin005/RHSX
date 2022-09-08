const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        const order = await Order.assignOrderType({
            _id: ObjectId(),
            type: MarketOrder.TYPE,
            timestamp: new Date(),
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            status: Order.UNSUBMITTED,
            quantity: interaction.options.getInteger('quantity'),
            quantityFilled: 0
        });
        global.current.order = order._id;
        await order.submit();
	}
};
