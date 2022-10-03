module.exports = {
    execute: async function (interaction) {
        console.log(interaction.component);
        interaction.component.setDisabled(true);
        await interaction.update({ components: interaction.message.components });
    }
};
