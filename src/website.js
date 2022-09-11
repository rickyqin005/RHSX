require('dotenv').config();
// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// Express
const express = require('express');
const app = express();
const port = 3000;

const { Ticker, Price, Tools } = require('./rhsx');
global.current = {
    mongoSession: null
};

async function displayBoardString() {
    let str = `Last updated at ${Tools.dateStr(new Date())}\n`;
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

async function run() {
    await global.mongoClient.connect();
    console.log('Connected to MongoDB');
    app.get('/', async (req, res) => {
        const startTime = new Date();
        global.current.mongoSession = global.mongoClient.startSession();
        res.send(await displayBoardString());
        await global.current.mongoSession.endSession();
        console.log(`processed request at ${Tools.dateStr(new Date())}, took ${new Date()-startTime}ms`);
    });
    app.listen(port, () => console.log(`listening at port ${port}`));
}
run();