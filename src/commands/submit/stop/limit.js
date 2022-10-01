const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Market, Trader, Order, NormalOrder, LimitOrder, StopOrder, Price } = require('../../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('limit')
        .setDescription('Submit a stop order that triggers a limit order')
        .addStringOption(Order.OPTION.TICKER().setRequired(true))
        .addNumberOption(StopOrder.OPTION.TRIGGER_PRICE().setRequired(true))
        .addStringOption(Order.OPTION.DIRECTION().setRequired(true))
        .addIntegerOption(NormalOrder.OPTION.QUANTITY().setRequired(true))
        .addNumberOption(LimitOrder.OPTION.PRICE().setRequired(true)),
    ephemeral: false,
    execute: async function (interaction) {
        if(!global.market.isOpen) throw Market.ERROR.MARKET_CLOSED;
        const trader = Trader.getTrader(interaction.user.id);
        const executedOrder = Order.assignOrderType({
            type: LimitOrder.TYPE,
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            quantity: interaction.options.getInteger('quantity'),
            price: Price.toPrice(interaction.options.getNumber('limit_price'))
        }).deserialize();
        Order.cache.set(executedOrder._id, executedOrder);
        const order = Order.assignOrderType({
            type: StopOrder.TYPE,
            user: interaction.user.id,
            direction: interaction.options.getString('direction'),
            ticker: interaction.options.getString('ticker'),
            triggerPrice: Price.toPrice(interaction.options.getNumber('trigger_price')),
            executedOrder: executedOrder._id
        }).deserialize();
        Order.cache.set(order._id, order);
        order.submit();
        await order.process();
        return { content: order.statusString() };
    }
};
