const { MessageActionRow } = require('discord.js');
const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('experiment')
        .setDescription('Used to test out new commands or features'),
    ephemeral: true,
    writesToDB: false,
    hasInteractiveMessage: true,

    execute: async function (interaction) {
        const row = new MessageActionRow()
            .addComponents(
                require('../../../button/GO_TO_BEGINNING').data(),
                require('../../../button/GO_TO_PREVIOUS').data(),
                require('../../../button/GO_TO_NEXT').data(),
                require('../../../button/GO_TO_END').data());
        return { components: [row] };
    }
};
