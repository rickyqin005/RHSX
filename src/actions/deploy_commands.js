require('dotenv').config();

const { REST } = require('@discordjs/rest');
const rest = new REST({ version: '9' }).setToken(process.env['BOT_TOKEN']);
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const { Ticker, Order, NormalOrder, LimitOrder, StopOrder } = require('../rhsx');

module.exports = {
    run: async function () {
        const commands = [
            new SlashCommandBuilder()
                .setName('join')
                .setDescription('Become a trader'),
            new SlashCommandBuilder()
                .setName('orders')
                .setDescription('View your orders')
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('find')
                        .setDescription('Find a specific order')
                        .addStringOption(Order.OPTION.ID.setRequired(true))
                )
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('query')
                        .setDescription('Query your orders')
                        .addStringOption(Order.OPTION.TYPE)
                        .addStringOption(Order.OPTION.DIRECTION)
                        .addStringOption(Order.OPTION.TICKER)
                        .addStringOption(Order.OPTION.STATUS)
                )
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('cancel')
                        .setDescription('Cancel an order')
                        .addStringOption(Order.OPTION.ID.setRequired(true))
                ),
            new SlashCommandBuilder()
                .setName('submit')
                .setDescription('Submit an order')
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('limit')
                        .setDescription('Submit a limit order')
                        .addStringOption(Order.OPTION.TICKER).setRequired(true)
                        .addStringOption(Order.OPTION.DIRECTION).setRequired(true)
                        .addIntegerOption(NormalOrder.OPTION.QUANTITY).setRequired(true)
                        .addNumberOption(LimitOrder.OPTION.PRICE).setRequired(true)
                )
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('market')
                        .setDescription('Submit a market order')
                        .addStringOption(Order.OPTION.TICKER).setRequired(true)
                        .addStringOption(Order.OPTION.DIRECTION).setRequired(true)
                        .addIntegerOption(NormalOrder.OPTION.QUANTITY).setRequired(true)
                )
                .addSubcommandGroup(
                    new SlashCommandSubcommandGroupBuilder()
                        .setName('stop')
                        .setDescription('Submit a stop order')
                        .addSubcommand(
                            new SlashCommandSubcommandBuilder()
                                .setName('limit')
                                .setDescription('Submit a stop order that triggers a limit order')
                                .addStringOption(Order.OPTION.TICKER).setRequired(true)
                                .addStringOption(StopOrder.OPTION.TRIGGER_PRICE).setRequired(true)
                                .addStringOption(Order.OPTION.DIRECTION).setRequired(true)
                                .addIntegerOption(NormalOrder.OPTION.QUANTITY).setRequired(true)
                                .addNumberOption(LimitOrder.OPTION.PRICE).setRequired(true)
                        )
                        .addSubcommand(
                            new SlashCommandSubcommandBuilder()
                                .setName('market')
                                .setDescription('Submit a stop order that triggers a market order')
                                .addStringOption(Order.OPTION.TICKER).setRequired(true)
                                .addStringOption(StopOrder.OPTION.TRIGGER_PRICE).setRequired(true)
                                .addStringOption(Order.OPTION.DIRECTION).setRequired(true)
                                .addIntegerOption(NormalOrder.OPTION.QUANTITY).setRequired(true)
                        )
                ),
            new SlashCommandBuilder()
                .setName('trader')
                setDescription('View account info')
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('info')
                        .setDescription('View general account info')
                )
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('position')
                        .setDescription('View your positions')
                ),
            new SlashCommandBuilder()
                .setName('market')
                .setDescription('Manage the market (Execs only)')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('open')
                        .setDescription('Opens the market (Execs only)')
                )
                .addSubcommand(
                    new SlashCommandSubcommandBuilder()
                        .setName('close')
                        .setDescription('Closes the market (Execs only)')
                )
        ];
        for(const command of commands) {
            console.log(command);
            command = command.toJSON();
        }
        for(const [guildId, guild] of global.discordClient.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(global.discordClient.user.id, guildId), { body: commands });
            console.log(`Deployed slash commands to ${guild.name}`);
        }
    }
};
