const { MessageButton } = require('discord.js');

module.exports = {
    data: function () {
        return new MessageButton()
            .setCustomId('GO_TO_BEGINNING')
            .setEmoji('⏮️')
            .setStyle('PRIMARY');
    },
    execute: async function (interaction) {
        console.log(interaction.component);
        interaction.component.setDisabled(true);
        await interaction.update({ components: interaction.message.components });
    }
};
