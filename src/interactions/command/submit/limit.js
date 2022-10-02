const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Market, Trader, Order, NormalOrder, LimitOrder, Price } = require('../../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('limit')
        .setDescription('Submit a limit order')
        .addStringOption(Order.OPTION.TICKER().setRequired(true))
        .addStringOption(Order.OPTION.DIRECTION().setRequired(true))
        .addIntegerOption(NormalOrder.OPTION.QUANTITY().setRequired(true))
        .addNumberOption(LimitOrder.OPTION.PRICE().setRequired(true)),
    ephemeral: false,
    execute: async function (interaction) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
        const order = Order.assignOrderType({
            type: LimitOrder.TYPE,
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            quantity: interaction.options.getInteger('quantity'),
            price: Price.toPrice(interaction.options.getNumber('limit_price'))
        }).deserialize();
        Order.cache.set(order._id, order);
        order.submit();
        await order.process();
        return { content: order.statusString() };
    }
};
