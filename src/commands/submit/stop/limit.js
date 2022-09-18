const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order, LimitOrder, StopOrder, Price } = require('../../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction, mongoSession) {
        if(!global.market.isOpen) throw new Error('Market is closed');
        const trader = Trader.getTrader(interaction.user.id);
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
        }).resolve();
        if(order.executedOrder.direction == Order.BUY && !(order.ticker.lastTradedPrice < order.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
        if(order.executedOrder.direction == Order.SELL && !(order.triggerPrice < order.ticker.lastTradedPrice)) throw new Error('Trigger price must be less than the current price');
        await order.submit(mongoSession);
        interaction.editReply(order.statusString());
	}
};
