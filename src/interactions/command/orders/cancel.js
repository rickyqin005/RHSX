const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Trader, Order } = require('../../../rhsx');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('cancel')
        .setDescription('Cancel an order')
        .addStringOption(Order.OPTION.ID().setRequired(true)),
    ephemeral: false,
    writesToDB: true,
    hasInteractiveMessage: false,

    execute: async function (interaction) {
        const trader = Trader.getTrader(interaction.user.id);
        const order = await Order.queryOrder({
            _id: interaction.options.getString('order_id'),
            user: interaction.user.id
        });
        if(order == undefined) throw Order.ERROR.ORDER_NOT_FOUND;
        order.cancel(Order.CANCELLED_BY_TRADER);
        return { content: order.statusString() };
    }
};
