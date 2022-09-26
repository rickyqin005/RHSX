const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('query')
        .setDescription('Query your orders')
        .addStringOption(Order.OPTION.TYPE())
        .addStringOption(Order.OPTION.DIRECTION())
        .addStringOption(Order.OPTION.TICKER())
        .addStringOption(Order.OPTION.STATUS()),
    ephemeral: true,
    execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        const type = interaction.options.getString('type');
        const direction = interaction.options.getString('direction');
        const ticker = interaction.options.getString('ticker');
        let status = interaction.options.getString('status');
        if(status == 'pending') status = { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] };
        else if(status == 'completed') status = Order.COMPLETELY_FILLED;
        else if(status == 'cancelled') status = Order.CANCELLED;
        else status = { $in: [Order.CANCELLED, Order.NOT_FILLED, Order.PARTIALLY_FILLED, Order.COMPLETELY_FILLED] };
        const query = {};
        query.user = interaction.user.id;
        if(type != null) query.type = type;
        if(direction != null) query.direction = direction;
        if(ticker != null) query.ticker = ticker;
        if(status != null) query.status = status;
        const embed = await trader.templateEmbed();
        const orders = await Order.queryOrders(query, { timestamp: -1 });
        orders.forEach(order => embed.addFields(order.toOrderQueryEmbedFields()));
        embed.setTitle(`${orders.length} Order(s) Found`);
        return { embeds: [embed] };
    }
};
