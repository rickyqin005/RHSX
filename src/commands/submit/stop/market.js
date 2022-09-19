const { Trader, Order, MarketOrder, StopOrder, Price } = require('../../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
	execute: async function (interaction, mongoSession) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
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
                type: MarketOrder.TYPE,
                timestamp: new Date(),
                user: interaction.user.id,
                direction: interaction.options.getString('direction'),
                ticker: interaction.options.getString('ticker'),
                status: Order.UNSUBMITTED,
                quantity: interaction.options.getInteger('quantity'),
                quantityFilled: 0
            }
        }).resolve();
        await order.submit(mongoSession);
        interaction.editReply(order.statusString());
	}
};
