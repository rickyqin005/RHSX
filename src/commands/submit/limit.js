const { Market, Trader, Order, LimitOrder, Price } = require('../../rhsx');

module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
        const order = await Order.assignOrderType({
            type: LimitOrder.TYPE,
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            quantity: interaction.options.getInteger('quantity'),
            price: Price.toPrice(interaction.options.getNumber('limit_price'))
        }).resolve();
        await order.submit(mongoSession);
        return { content: order.statusString() };
    }
};
