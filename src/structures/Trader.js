const Price = require('../utils/Price');
const Tools = require('../utils/Tools');
const { Collection } = require('discord.js');

module.exports = class Trader {
    static DEFAULT_POSITION_LIMIT = 100000;

    static collection = global.mongoClient.db('RHSX').collection('Traders');
    static cache = new Collection();

    static async loadCache() {
        const startTime = new Date();
        this.cache.clear();
        (await this.collection.find({}).toArray()).forEach(trader => {
            this.cache.set(trader._id, new Trader(trader));
        });
        console.log(`Cached ${this.cache.size} Trader(s), took ${new Date()-startTime}ms`);
    }

    static getTrader(_id) {
        return (this.cache.get(_id) ?? null);
    }

    static async queryTraders(query, sort) {
        // const startTime = new Date();
        let res = await this.collection.find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) {
            const resOrig = res[i];
            res[i] = this.cache.get(resOrig._id);
            if(res[i] == undefined) {
                res[i] = new Trader(resOrig);
                this.cache.set(res[i]._id, res[i]);
            }
        }
        // console.log(`Trader.queryTraders(${String(JSON.stringify(query)).replace(/\n/g, " ")}, ${String(JSON.stringify(sort)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.joined = args.joined;
        this.positionLimit = args.positionLimit;
        this.balance = args.balance;
        this.positions = {};
        const Position = require('./Position');
        for(const pos in args.positions) this.positions[pos] = new Position(args.positions[pos]);
    }

    async infoEmbed() {
        const embed = (await this.templateEmbed())
            .setTitle('Trader Info')
            .addFields(
                { name: 'Account Value', value: Price.format(await this.getAccountValue()), inline: true },
                { name: 'Cash Balance', value: Price.format(this.balance), inline: true },
                { name: 'Joined', value: Tools.dateStr(this.joined), inline: false },
            );
        return { embeds: [embed] };
    }

    async positionEmbed() {
        const embed = (await this.templateEmbed())
            .setTitle('Positions')
            .addFields(
                { name: '\u200B', value: '**Symbol/Price**', inline: true },
                { name: '\u200B', value: '**Mkt Value/Quantity**', inline: true },
                { name: '\u200B', value: '**Open P&L**', inline: true },
            );
        for(const pos in this.positions) {
            const position = this.positions[pos];
            const Ticker = require('./Ticker');
            const price = Ticker.getTicker(pos).lastTradedPrice;
            if(position.quantity == 0) continue;
            embed.addFields(
                { name: position.ticker, value: Price.format(price), inline: true },
                { name: Price.format(price*position.quantity), value: `**${position.quantity}**`, inline: true },
                { name: Price.format(await this.calculateOpenPnL(position)), value: '\u200B', inline: true },
            );
        }
        return { embeds: [embed] };
    }

    async templateEmbed() {
        const { MessageEmbed } = require('discord.js');
        return new MessageEmbed()
            .setAuthor({ name: (await this.getDiscordUser()).tag })
            .setColor('#3ba55d');
    }

    async getDiscordUser() {
        return await global.discordClient.users.fetch(this._id);// only reference of global.discordClient
    }

    async getAccountValue() {
        const Ticker = require('./Ticker');
        let accountValue = this.balance;
        for(const pos in this.positions) {
            accountValue += this.positions[pos].quantity*(Ticker.getTicker(pos).lastTradedPrice);
        }
        return accountValue;
    }

    async getPendingOrders(/*add optional parameter for order type*/) {
        const Order = require('./orders/Order');
        return await Order.queryOrders({
            user: this._id,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { timestamp: -1 });
    }

    async addPosition(pos, mongoSession) {
        let currPos = this.positions[pos.ticker];
        if(currPos == undefined) this.positions[pos.ticker] = pos;
        else {
            if(Math.sign(currPos.quantity) == Math.sign(pos.quantity) || currPos.quantity == 0) {// increase size of current position
                currPos.quantity += pos.quantity;
                currPos.costBasis += pos.costBasis;
            } else if(Math.abs(currPos.quantity) > Math.abs(pos.quantity)) {// reduce size of current position
                currPos.costBasis += Math.round(currPos.costBasis*pos.quantity/currPos.quantity);
                currPos.quantity += pos.quantity;
            } else {// close current position and open new position in opposite direction
                let posPrice = pos.costBasis/pos.quantity;
                currPos.quantity += pos.quantity;
                currPos.costBasis = currPos.quantity*posPrice;
            }
        }
        this.balance -= pos.costBasis;
        await Trader.collection.updateOne({ _id: this._id }, { $set: { [`positions.${pos.ticker}`]: currPos, balance: this.balance } }, { session: mongoSession });
    }

    async calculateOpenPnL(position) {
        const Ticker = require('./Ticker');
        return Ticker.getTicker(position.ticker).lastTradedPrice*position.quantity - position.costBasis;
    }
};
