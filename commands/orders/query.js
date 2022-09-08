const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../rhsx');

module.exports = {
	execute: async function (interaction) {
        const trader = await Trader.getTrader(interaction.user.id);
        if(trader == null) throw new Error('Not a trader');
        const type = interaction.options.getString('type');
        const direction = interaction.options.getString('direction');
        const ticker = interaction.options.getString('ticker');
        let status = interaction.options.getString('status');
        if(status == 'pending') status = { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] };
        else if(status == 'completed') status = Order.COMPLETELY_FILLED;
        else if(status == 'cancelled') status = Order.CANCELLED;
        const query = {};
        query.user = interaction.user.id;
        if(type != null) query.type = type;
        if(direction != null) query.direction = direction;
        if(ticker != null) query.ticker = ticker;
        if(status != null) query.status = status;
        const embed = await trader.templateEmbed();
        (await Order.queryOrders(query, { timestamp: -1 })).forEach(order => embed.addFields(order.toOrderQueryEmbedFields()));
        interaction.editReply({ embeds: [embed] });
	}
};
