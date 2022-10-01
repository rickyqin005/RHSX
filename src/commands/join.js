const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../rhsx');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Become a trader'),
    ephemeral: false,
    execute: async function (interaction) {
        try {
            const trader = Trader.getTrader(interaction.user.id);
            throw Trader.ERROR.ALREADY_A_TRADER;
        } catch(error) {
            if(error == Trader.ERROR.NOT_A_TRADER) {
                const newTrader = new Trader({ _id: interaction.user.id }).deserialize();
                Trader.changedDocuments.add(newTrader);
                Trader.cache.set(newTrader._id, newTrader);
                return { content: 'You\'re now a trader.' };
            } else throw error;
        }
    }
};
