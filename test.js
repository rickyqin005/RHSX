require('dotenv').config();

// Discord
const { Client, Intents, MessageEmbed } = require('discord.js');
const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const CHANNEL = {};
async function run() {
    await discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord!`);
    CHANNEL.DISPLAY_BOARD = await discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
    CHANNEL.LEADERBOARD = await discordClient.channels.fetch(process.env['LEADERBOARD_CHANNEL_ID']);

    const embed1 = new MessageEmbed()
        .setTitle('Trader Info')
        .setAuthor({ name: 'rickyqin005#1454' })
        .addFields(
            { name: 'Account Value', value: '0.00', inline: true },
            { name: 'Cash Balance', value: '500.00', inline: true },
        );
    const embed2 = new MessageEmbed()
        .setTitle('Positions')
        .addFields(
            { name: '\u200B', value: '**Symbol/Price**', inline: true },
            { name: '\u200B', value: '**Mkt Value/Quantity**', inline: true },
            { name: '\u200B', value: '**Open P&L**', inline: true },

            { name: 'CRZY', value: '5.00', inline: true },
            { name: '-500.00', value: '-100', inline: true },
            { name: '+0.00', value: '+0.00%', inline: true },

            { name: 'TAME', value: '10.00', inline: true },
            { name: '260000.00', value: '26000', inline: true },
            { name: '+0.00', value: '+0.00%', inline: true },
        );
    const embed3 = new MessageEmbed()
    .setTitle('Pending Orders')
    .addFields(
        { name: 'LIMIT', value: '\u200B', inline: true },
        { name: '8/19/2022, 3:40:45 PM', value: '#62ffe73deb9315a0ec6ed536', inline: true },
        { name: 'SELL x200000 TAME @10000000.00', value: '**(x100000 filled)**', inline: true },

        { name: 'LIMIT', value: '\u200B', inline: true },
        { name: '8/19/2022, 3:40:45 PM', value: '#62ffe73deb9315a0ec6ed536', inline: true },
        { name: 'SELL x25 TAME @10.05', value: '**(x0 filled)**', inline: true },

        { name: 'STOP', value: '\u200B', inline: true },
        { name: '8/10/2022, 11:26:27 AM', value: '#62f3ce23b7889a8913255a2d', inline: true },
        { name: 'CRZY @10000000.00', value: '**SELL x200000 @10000000.00**', inline: true },

        { name: 'STOP', value: '\u200B', inline: true },
        { name: '8/10/2022, 11:26:27 AM', value: '#62f3ce23b7889a8913255a2d', inline: true },
        { name: 'CRZY @9.99', value: '**SELL x10 @9.99**', inline: true },

        { name: 'MARKET', value: '\u200B', inline: true },
        { name: '8/18/2022, 8:04:22 PM', value: '#62ffe73deb9315a0ec6ed536', inline: true },
        { name: 'BUY x10 CRZY', value: '**(x5 filled)**', inline: true },
    );
    const embed4 = new MessageEmbed()
    .setTitle('Title')
    .addFields(
        { name: '80 characters', value: '12345678901234567890123456789012345678901234567890123456789012345678901234567890', inline: true },
    );

    // CHANNEL.LEADERBOARD.send({ embeds: [embed4] });
    CHANNEL.DISPLAY_BOARD.send('\u200B');
    CHANNEL.DISPLAY_BOARD.send('\u200B');
    CHANNEL.DISPLAY_BOARD.send('\u200B');
}
run();
