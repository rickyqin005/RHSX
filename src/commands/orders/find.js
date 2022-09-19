const { Trader, Order } = require('../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        const order = await Order.queryOrder({
            _id: new ObjectId(interaction.options.getString('order_id')),
            user: interaction.user.id
        });
        if(order == null) throw Order.ORDER_NOT_FOUND;
        interaction.editReply({ embeds: [await order.toEmbed()] });
	}
};
