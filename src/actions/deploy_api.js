// Express
const express = require('express');
const app = express();
const port = 3000;

const fs = require('fs');
const path = require('path');
const { Tools } = require('../rhsx');

async function deployAPI(currDir, currEndpoint) {
    const files = fs.readdirSync(currDir);
    for(const file of files) {
        const newDir = `${currDir}${file}`;
        if(fs.lstatSync(newDir).isDirectory()) {
            await deployAPI(`${newDir}/`, `${currEndpoint}${file}/`);
        } else {
            const newEndpoint = `${currEndpoint}${file.substring(0, file.length-3)}`;
            app.get(newEndpoint, async (req, res) => {
                const startTime = new Date();
                global.current.mongoSession = global.mongoClient.startSession();
                res.json(await require(newDir).getJSON());
                await global.current.mongoSession.endSession();
                console.log(`processed ${newEndpoint} at ${Tools.dateStr(new Date())}, took ${new Date()-startTime}ms`);
            });
        }
    }
}
module.exports = {
    run: async function () {
        await deployAPI(path.join(__dirname, '../api/'), '/api/');
        app.listen(port, () => console.log(`Listening at port ${port}`));
    }
};