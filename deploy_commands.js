require('dotenv').config();

const { REST } = require('@discordjs/rest');
const rest = new REST({ version: '9' }).setToken(process.env['BOT_TOKEN']);
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const { Ticker } = require('./rhsx');

const DIRECTION_CHOICES = [
    { name: 'BUY', value: 'BUY' },
    { name: 'SELL', value: 'SELL' }
];
const TICKER_CHOICES = [];
(await Ticker.queryTickers({})).forEach((ticker) => TICKER_CHOICES.push({ name: ticker._id, value: ticker._id }));

const commands = [
    { name: 'join', description: 'Become a trader' },
    { name: 'position', description: 'View your portfolio' },
    {
        name: 'orders',
        description: 'View your orders',
        options: [
            {
                type: 1,
                name: 'find',
                description: 'Find a specific order',
                options: [
                    {
                        required: true,
                        type: 3,
                        name: 'order_id',
                        description: 'order id',
                        min_length: 24,
                        max_length: 24
                    }
                ]
            },
            {
                type: 1,
                name: 'query',
                description: 'Query your orders',
                options: [
                    {
                        required: false,
                        type: 3,
                        name: 'type',
                        description: 'type',
                        choices: [
                            { name: 'Limit Order', value: 'limit' },
                            { name: 'Market Order', value: 'market' },
                            { name: 'Stop Order', value: 'stop' }
                        ]
                    },
                    {
                        required: false,
                        type: 3,
                        name: 'direction',
                        description: 'buy or sell',
                        choices: DIRECTION_CHOICES
                    },
                    {
                        required: false,
                        type: 3,
                        name: 'ticker',
                        description: 'ticker',
                        choices: TICKER_CHOICES
                    },
                    {
                        required: false,
                        type: 3,
                        name: 'status',
                        description: 'status',
                        choices: [
                            { name: 'Pending', value: 'pending' },
                            { name: 'Completed', value: 'completed' },
                            { name: 'Cancelled', value: 'cancelled' }
                        ]
                    }
                ]
            },
            {
                type: 1,
                name: 'cancel',
                description: 'Cancel an order',
                options: [
                    {
                        required: true,
                        type: 3,
                        name: 'order_id',
                        description: 'order id',
                        min_length: 24,
                        max_length: 24
                    }
                ]
            }
        ]
    },
    {
        name: 'submit',
        description: 'Submit an order',
        options: [
            {
                type: 1,
                name: 'limit',
                description: 'Submit a limit order',
                options: [
                    {
                        required: true,
                        type: 3,
                        name: 'ticker',
                        description: 'ticker',
                        choices: TICKER_CHOICES
                    },
                    {
                        required: true,
                        type: 3,
                        name: 'direction',
                        description: 'buy or sell',
                        choices: DIRECTION_CHOICES
                    },
                    {
                        required: true,
                        type: 4,
                        name: 'quantity',
                        description: 'quantity',
                        min_value: 1,
                        max_value: 1000000
                    },
                    {
                        required: true,
                        type: 10,
                        name: 'limit_price',
                        description: 'limit price',
                        min_value: 0,
                        max_value: 1000000000
                    }
                ]
            },
            {
                type: 1,
                name: 'market',
                description: 'Submit a market order',
                options: [
                    {
                        required: true,
                        type: 3,
                        name: 'ticker',
                        description: 'ticker',
                        choices: TICKER_CHOICES
                    },
                    {
                        required: true,
                        type: 3,
                        name: 'direction',
                        description: 'buy or sell',
                        choices: DIRECTION_CHOICES
                    },
                    {
                        required: true,
                        type: 4,
                        name: 'quantity',
                        description: 'quantity',
                        min_value: 1,
                        max_value: 1000000
                    }
                ]
            },
            {
                type: 2,
                name: 'stop',
                description: 'Submit a stop order',
                options: [
                    {
                        type: 1,
                        name: 'limit',
                        description: 'Submit a stop order that triggers a limit order',
                        options: [
                            {
                                required: true,
                                type: 3,
                                name: 'ticker',
                                description: 'ticker',
                                choices: TICKER_CHOICES
                            },
                            {
                                required: true,
                                type: 10,
                                name: 'trigger_price',
                                description: 'trigger price',
                                min_value: 0,
                                max_value: 1000000000
                            },
                            {
                                required: true,
                                type: 3,
                                name: 'direction',
                                description: 'buy or sell',
                                choices: DIRECTION_CHOICES
                            },
                            {
                                required: true,
                                type: 4,
                                name: 'quantity',
                                description: 'quantity',
                                min_value: 1,
                                max_value: 1000000
                            },
                            {
                                required: true,
                                type: 10,
                                name: 'limit_price',
                                description: 'limit price',
                                min_value: 0,
                                max_value: 1000000000
                            }
                        ]
                    },
                    {
                        type: 1,
                        name: 'market',
                        description: 'Submit a stop order that triggers a market order',
                        options: [
                            {
                                required: true,
                                type: 3,
                                name: 'ticker',
                                description: 'ticker',
                                choices: TICKER_CHOICES
                            },
                            {
                                required: true,
                                type: 10,
                                name: 'trigger_price',
                                description: 'trigger price',
                                min_value: 0,
                                max_value: 1000000000
                            },
                            {
                                required: true,
                                type: 3,
                                name: 'direction',
                                description: 'buy or sell',
                                choices: DIRECTION_CHOICES
                            },
                            {
                                required: true,
                                type: 4,
                                name: 'quantity',
                                description: 'quantity',
                                min_value: 1,
                                max_value: 1000000
                            }
                        ]
                    }
                ]
            }
        ]
    },
    // new SlashCommandBuilder()
	// .setName('halt')
	// .setDescription('Suspends trading')
	// .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // .toJSON()
];

module.exports = {
    initialize: async function () {
        await rest.put(
            Routes.applicationGuildCommands(process.env['BOT_ID'], process.env['FINANCE_CLUB_GUILD_ID']),
            { body: commands },
        );
    }
};
