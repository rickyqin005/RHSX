const { Market, Trader, Order, MarketOrder } = require('../../rhsx');

module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
        const order = await Order.assignOrderType({
            type: MarketOrder.TYPE,
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            quantity: interaction.options.getInteger('quantity')
        }).resolve();
        await order.submit(mongoSession);
        return { content: order.statusString() };
    }
};
