const { Trader, Order, MarketOrder } = require('../../rhsx');
const { ObjectId } = require('mongodb');

module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
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
        }).resolve();
        await order.submit(mongoSession);
        return { content: order.statusString() };
    }
};
