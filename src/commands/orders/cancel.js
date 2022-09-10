const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        const order = await Order.queryOrder({
            _id: new ObjectId(interaction.options.getString('order_id')),
            user: interaction.user.id
        });
        if(order == null) throw new Error('Invalid id');
        global.current.order = order._id;
        await order.cancel();
	}
};
