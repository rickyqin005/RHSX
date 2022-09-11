const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order, LimitOrder, StopOrder, Price } = require('../../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        const order = await Order.assignOrderType({
            _id: ObjectId(),
            type: StopOrder.TYPE,
            timestamp: new Date(),
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            status: Order.UNSUBMITTED,
            triggerPrice: Price.toPrice(interaction.options.getNumber('trigger_price')),
            executedOrder: {
                _id: ObjectId(),
                type: LimitOrder.TYPE,
                timestamp: new Date(),
                user: interaction.user.id,
                direction: interaction.options.getString('direction'),
                ticker: interaction.options.getString('ticker'),
                status: Order.UNSUBMITTED,
                quantity: interaction.options.getInteger('quantity'),
                quantityFilled: 0,
                price: Price.toPrice(interaction.options.getNumber('limit_price'))
            }
        });
        if(order.executedOrder.direction == Order.BUY && !(order.ticker.lastTradedPrice < order.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
        if(order.executedOrder.direction == Order.SELL && !(order.triggerPrice < order.ticker.lastTradedPrice)) throw new Error('Trigger price must be less than the current price');
        await order.submit();
        interaction.editReply(order.statusString());
	}
};
