const { REST } = require('@discordjs/rest');
const rest = new REST({ version: '9' }).setToken(process.env['BOT_TOKEN']);
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v10');

const fs = require('fs');
const path = require('path');

function deployCommands(dir) {
    const commands = [];
    const NO_DESCRIPTION = '.';
    for(const file of fs.readdirSync(dir)) {
        const subDir = path.join(dir, file);
        if(fs.lstatSync(subDir).isDirectory()) {
            const command = new SlashCommandBuilder()
                .setName(file)
                .setDescription(NO_DESCRIPTION);
            for(const subFile of fs.readdirSync(subDir)) {
                const subSubDir = path.join(subDir, subFile);
                if(fs.lstatSync(subSubDir).isDirectory()) {
                    const subCommandGroup = new SlashCommandSubcommandGroupBuilder()
                        .setName(subFile)
                        .setDescription(NO_DESCRIPTION);
                    for(const subSubFile of fs.readdirSync(subSubDir)) {
                        const subSubSubDir = path.join(subSubDir, subSubFile);
                        subCommandGroup.addSubcommand(require(subSubSubDir).data);
                    }
                    command.addSubcommandGroup(subCommandGroup);
                } else {
                    command.addSubcommand(require(subSubDir).data);
                }
            }
            commands.push(command);
        } else {
            commands.push(require(subDir).data);
        }
    }
    return commands;
}

module.exports = {
    run: async function () {
        const commands = deployCommands(path.join(__dirname, '../', 'commands'));
        commands.forEach(command => command = command.toJSON());
        for(const [guildId, guild] of global.discordClient.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(global.discordClient.user.id, guildId), { body: commands });
            console.log(`Deployed slash commands to ${guild.name}`);
        }
    }
};
