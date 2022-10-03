const { MessageActionRow, MessageButton } = require('discord.js');
const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Order } = require('../../../../rhsx');

function GO_TO_BEGINNING() {
    return new MessageButton()
        .setCustomId('GO_TO_BEGINNING')
        .setEmoji('⏮️')
        .setStyle('PRIMARY');
}
function GO_TO_PREVIOUS() {
    return new MessageButton()
        .setCustomId('GO_TO_PREVIOUS')
        .setEmoji('⏪')
        .setStyle('PRIMARY');
}
function GO_TO_NEXT() {
    return new MessageButton()
        .setCustomId('GO_TO_NEXT')
        .setEmoji('⏩')
        .setStyle('PRIMARY');
}
function GO_TO_END() {
    return new MessageButton()
        .setCustomId('GO_TO_END')
        .setEmoji('⏭️')
        .setStyle('PRIMARY');
}

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('experiment')
        .setDescription('Used to test out new commands or features'),
    ephemeral: true,
    execute: async function (interaction) {
        const row = new MessageActionRow()
			.addComponents(GO_TO_BEGINNING(), GO_TO_PREVIOUS(), GO_TO_NEXT(), GO_TO_END());
        return { components: [row] };
    }
};
