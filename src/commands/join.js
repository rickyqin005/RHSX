const { SlashCommandBuilder } = require('@discordjs/builders');
const { Trader } = require('../rhsx');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Become a trader'),
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        try {
            const trader = Trader.getTrader(interaction.user.id);
            throw Trader.ERROR.ALREADY_A_TRADER;
        } catch(error) {
            if(error == Trader.ERROR.NOT_A_TRADER) {
                await new Trader({
                    _id: interaction.user.id
                }).addToDB(mongoSession);
                return { content: 'You\'re now a trader.' };
            } else throw error;
        }
    }
};
