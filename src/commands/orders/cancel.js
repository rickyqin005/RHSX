const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction, mongoSession) {
        const trader = Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        const order = await Order.queryOrder({
            _id: new ObjectId(interaction.options.getString('order_id')),
            user: interaction.user.id
        });
        if(order == null) throw new Error('Invalid id');
        await order.cancel(Order.CANCELLED_BY_TRADER, mongoSession);
        interaction.editReply(order.statusString());
	}
};
