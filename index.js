require('dotenv').config();

// Discord
const { Client, Intents, MessageEmbed } = require('discord.js');
global.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Local Modules
const { Trader, Order, NormalOrder, LimitOrder, MarketOrder, StopOrder, Ticker, Price, Tools } = require('./rhsx');

const orderBook = new class {
    displayBoardMessage;
    leaderBoardMessage;
    startUpTime;

    async initialize() {
        this.displayBoardMessage = await CHANNEL.DISPLAY_BOARD.messages.fetch(process.env['DISPLAY_BOARD_MESSAGE_ID']);
        this.leaderBoardMessage = await CHANNEL.LEADERBOARD.messages.fetch(process.env['LEADERBOARD_MESSAGE_ID']);
        this.startUpTime = new Date();
        setTimeout(orderBook.updateDisplayBoard, 3000);
    }

    async updateDisplayBoard() {
        await orderBook.displayBoardMessage.edit(await orderBook.toDisplayBoardString());
        // console.log('updated display board');
        setTimeout(orderBook.updateLeaderBoard, 3000);
    }

    async updateLeaderBoard() {
        await orderBook.leaderBoardMessage.edit(await orderBook.toLeaderBoardString());
        // console.log('updated leaderboard');
        setTimeout(orderBook.updateDisplayBoard, 3000);
    }

    async toDisplayBoardString() {
        let str = '';
        str += `Last updated at ${Tools.dateStr(new Date())}\n`;
        str += '```\n';
        str += Tools.setW('Ticker', 10) + Tools.setW('Price', 10) + Tools.setW('Bid', 10) + Tools.setW('Ask', 10) + Tools.setW('Volume', 10) + '\n';
        const tickers = await Ticker.queryTickers({});
        for(const ticker of tickers) {
            let topBid = (await ticker.getBids())[0];
            if(topBid != undefined) topBid = topBid.price;
            let topAsk = (await ticker.getAsks())[0];
            if(topAsk != undefined) topAsk = topAsk.price;
            str += Tools.setW(ticker._id, 10) + Tools.setW(Price.format(ticker.lastTradedPrice), 10) +
            Tools.setW(Price.format(topBid), 10) + Tools.setW(Price.format(topAsk), 10) + Tools.setW(ticker.volume, 10) + '\n';
        }
        str += '```\n';

        for(const ticker of tickers) {
            str += `Ticker: ${ticker._id}\n`;
            str += '```\n';
            str += Tools.setW('Bids', 15) + 'Asks' + '\n';
            let bids = await ticker.getBids();
            let asks = await ticker.getAsks();
            for(let i = 0; i < Math.max(bids.length, asks.length); i++) {
                if(i < bids.length) str += Tools.setW(bids[i].toDisplayBoardString(), 15);
                else str += Tools.setW('', 15);
                if(i < asks.length) str += asks[i].toDisplayBoardString();
                str += '\n';
            }
            str += '```\n';
        }
        return str;
    }

    async toLeaderBoardString() {
        let str = '';
        str += `Last updated at ${Tools.dateStr(new Date())}\n`;
        str += '```\n';
        str += Tools.setW('Username', 20) + Tools.setW('Account Value', 10) + '\n';
        const traders = await Trader.queryTraders({}, {});
        for(const trader of traders) {
            str += Tools.setW((await trader.getDiscordUser()).tag, 20) +
            Tools.setW(Price.format(await trader.getAccountValue()), 10) + '\n';
        }
        str += '```\n';
        return str;
    }
}();

global.current = {
    interaction: null,
    order: null,
    mongoSession: null
};
const interactionList = [];
const interactionHandler = async function () {
    if(interactionList.length > 0) {
        const interaction = interactionList[0];
        interactionList.splice(0, 1);
        console.log(`started processing interaction ${interaction.id}`);
        global.current = {
            interaction: interaction,
            order: null,
            mongoSession: global.mongoClient.startSession()
        }
        await global.current.mongoSession.withTransaction(async session => {
            try {
                if(interaction.commandName == 'join') {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader != null) throw new Error('Already a trader');
                    await Trader.collection.insertOne(new Trader({
                        _id: interaction.user.id,
                        positionLimit: Trader.DEFAULT_POSITION_LIMIT,
                        balance: 0,
                        positions: {}
                    }), global.current.mongoSession);
                    interaction.editReply(`You're now a trader.`);

                } else if(interaction.commandName == 'position') {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    interaction.editReply(await trader.toString());

                } else if(interaction.commandName == 'orders') {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    if(interaction.options.getSubcommand() == 'find') {
                        const order = await Order.getOrder(new ObjectId(interaction.options.getString('order_id')));
                        if(order == null) throw new Error('Invalid id');
                        interaction.editReply({ embeds: [await order.toEmbed()] });

                    } else if(interaction.options.getSubcommand() == 'query') {
                        const type = interaction.options.getString('type');
                        const direction = interaction.options.getString('direction');
                        const ticker = interaction.options.getString('ticker');
                        let status = interaction.options.getString('status');
                        if(status == 'pending') status = { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] };
                        else if(status == 'completed') status = Order.COMPLETELY_FILLED;
                        else if(status == 'cancelled') status = Order.CANCELLED;
                        const query = {};
                        if(type != null) query.type = type;
                        if(direction != null) query.direction = direction;
                        if(ticker != null) query.ticker = ticker;
                        if(status != null) query.status = status;
                        const embed = await trader.templateEmbed();
                        (await Order.queryOrders(query, { timestamp: -1 })).forEach(order => embed.addFields(order.toOrderQueryEmbedFields()));
                        interaction.editReply({ embeds: [embed] });

                    } else if(interaction.options.getSubcommand() == 'cancel') {
                        const order = await Order.getOrder(new ObjectId(interaction.options.getString('order_id')));
                        if(order == null) throw new Error('Invalid id');
                        global.current.order = order._id;
                        await order.cancel();
                    }

                } else if(interaction.commandName == 'submit') {
                    const trader = await Trader.getTrader(interaction.user.id);
                    if(trader == null) throw new Error('Not a trader');
                    let order = {
                        _id: ObjectId(),
                        timestamp: new Date(),
                        user: interaction.user.id,
                        direction: interaction.options.getString('direction'),
                        ticker: interaction.options.getString('ticker'),
                        status: Order.UNSUBMITTED
                    };
                    if(interaction.options.getSubcommandGroup(false) == null) {
                        order.quantity = interaction.options.getInteger('quantity');
                        order.quantityFilled = 0;
                        if(interaction.options.getSubcommand(false) == LimitOrder.TYPE) {
                            order.price = Price.toPrice(interaction.options.getNumber('limit_price'));
                            order.type = LimitOrder.TYPE;
                        } else if(interaction.options.getSubcommand(false) == MarketOrder.TYPE) {
                            order.type = MarketOrder.TYPE;
                        }
                    } else if(interaction.options.getSubcommandGroup(false) == StopOrder.TYPE) {
                        order.triggerPrice = Price.toPrice(interaction.options.getNumber('trigger_price'));
                        order.type = StopOrder.TYPE;
                        const executedOrder = {
                            _id: ObjectId(),
                            type: interaction.options.getSubcommand(),
                            timestamp: new Date(),
                            user: interaction.user.id,
                            direction: interaction.options.getString('direction'),
                            ticker: interaction.options.getString('ticker'),
                            status: Order.UNSUBMITTED,
                            quantity: interaction.options.getInteger('quantity'),
                            quantityFilled: 0
                        };
                        if(executedOrder.direction == Order.BUY && !((await Ticker.getTicker(order.ticker)).lastTradedPrice < order.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
                        if(executedOrder.direction == Order.SELL && !(order.triggerPrice < (await Ticker.getTicker(order.ticker)).lastTradedPrice)) throw new Error('Trigger price must be less than the current price');
                        if(executedOrder.type == LimitOrder.TYPE) {
                            executedOrder.price = Price.toPrice(interaction.options.getNumber('limit_price'));
                        }
                        order.executedOrder = executedOrder;
                    }
                    order = await Order.assignOrderType(order);
                    global.current.order = order._id;
                    await order.submit();

                }
            } catch(error) {
                console.log(error);
                interaction.editReply(`Error: ${error.message}`);
                await global.current.mongoSession.abortTransaction();
            }
        });
        await global.current.mongoSession.endSession();
        global.current = {
            interaction: null,
            order: null,
            mongoSession: null
        };
        console.log(`finished processing interaction ${interaction.id}`);
    }
    setTimeout(interactionHandler, 250);
}
global.discordClient.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return;
    console.log(`received interaction ${interaction.id}`);
    await interaction.deferReply();
    interactionList.push(interaction);
});
global.discordClient.on('debug', console.log);
// global.discordClient.on('apiRequest', () => console.log('api request'));
// global.discordClient.on('apiResponse', () => console.log('api response'));

const CHANNEL = {};
async function run() {
    await global.mongoClient.connect();
    console.log(`Connected to MongoDB!`);
    await global.discordClient.login(process.env['BOT_TOKEN']);
    console.log(`Connected to Discord!`);
    CHANNEL.DISPLAY_BOARD = await global.discordClient.channels.fetch(process.env['DISPLAY_BOARD_CHANNEL_ID']);
    CHANNEL.LEADERBOARD = await global.discordClient.channels.fetch(process.env['LEADERBOARD_CHANNEL_ID']);
    await orderBook.initialize();
    await require('./commands').initialize();
    interactionHandler();
}
run();
