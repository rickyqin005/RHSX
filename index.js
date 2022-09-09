require('dotenv').config();

// MongoDB
const { MongoClient, ServerApiVersion } = require('mongodb');
global.mongoClient = new MongoClient(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await global.mongoClient.connect();
    console.log('Connected to MongoDB');
    await require('./threads/command_processer').start();
    await require('./threads/display_board_updater').start();
    await require('./threads/leaderboard_updater').start();
}
run();
