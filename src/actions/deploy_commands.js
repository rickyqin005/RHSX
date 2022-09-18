require('dotenv').config();

const { REST } = require('@discordjs/rest');
const rest = new REST({ version: '9' }).setToken(process.env['BOT_TOKEN']);
const { Routes } = require('discord-api-types/v9');
const { Ticker, NormalOrder, LimitOrder, StopOrder } = require('../rhsx');

module.exports = {
    run: async function () {
        const DIRECTION_CHOICES = [
            { name: 'BUY', value: 'BUY' },
            { name: 'SELL', value: 'SELL' }
        ];
        const TICKER_CHOICES = [];
        Ticker.getTickers().forEach((ticker) => TICKER_CHOICES.push({ name: ticker._id, value: ticker._id }));
        const commands = [
            { name: 'join', description: 'Become a trader' },
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
                                min_value: NormalOrder.MIN_QUANTITY,
                                max_value: NormalOrder.MAX_QUANTITY
                            },
                            {
                                required: true,
                                type: 10,
                                name: 'limit_price',
                                description: 'limit price',
                                min_value: LimitOrder.MIN_PRICE,
                                max_value: LimitOrder.MAX_PRICE
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
                                min_value: NormalOrder.MIN_QUANTITY,
                                max_value: NormalOrder.MAX_QUANTITY
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
                                        min_value: StopOrder.MIN_TRIGGER_PRICE,
                                        max_value: StopOrder.MAX_TRIGGER_PRICE
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
                                        min_value: NormalOrder.MIN_QUANTITY,
                                        max_value: NormalOrder.MAX_QUANTITY
                                    },
                                    {
                                        required: true,
                                        type: 10,
                                        name: 'limit_price',
                                        description: 'limit price',
                                        min_value: LimitOrder.MIN_PRICE,
                                        max_value: LimitOrder.MAX_PRICE
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
                                        min_value: StopOrder.MIN_TRIGGER_PRICE,
                                        max_value: StopOrder.MAX_TRIGGER_PRICE
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
                                        min_value: NormalOrder.MIN_QUANTITY,
                                        max_value: NormalOrder.MAX_QUANTITY
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                name: 'trader',
                description: 'View account info',
                options: [
                    {
                        type: 1,
                        name: 'info',
                        description: 'View general account info'
                    },
                    {
                        type: 1,
                        name: 'position',
                        description: 'View your positions'
                    }
                ]
            },
            {
                name: 'market',
                description: 'Manage the market (Execs only)',
                options: [
                    {
                        type: 1,
                        name: 'open',
                        description: 'Opens the market (Execs only)'
                    },
                    {
                        type: 1,
                        name: 'close',
                        description: 'Closes the market (Execs only)'
                    }
                ],
                default_member_permissions: '8'
            }
        ];
        for(const [guildId, guild] of global.discordClient.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(process.env['BOT_ID'], guildId), { body: commands });
            console.log(`Deployed slash commands to ${guild.name}`);
        }
    }
};
