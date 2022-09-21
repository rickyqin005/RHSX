const { Trader, Order, LimitOrder, StopOrder, Price } = require('../../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
    ephemeral: false,
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
        await order.submit(mongoSession);
        return { content: order.statusString() };
    }
};
