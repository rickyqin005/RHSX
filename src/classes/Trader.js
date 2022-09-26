const Price = require('../utils/Price');
const Tools = require('../utils/Tools');
const { Collection } = require('discord.js');
const { ObjectId } = require('mongodb');

module.exports = class Trader {
    static DEFAULT_STARTING_BALANCE = Price.toPrice(20000);
    static DEFAULT_COST_PER_ORDER_SUBMITTED = Price.toPrice(2);
    static DEFAULT_COST_PER_SHARE_TRADED = Price.toPrice(0.04);
    static DEFAULT_MIN_POSITION_LIMIT = -10000;
    static DEFAULT_MAX_POSITION_LIMIT = 10000;
    static ERROR = {
        NOT_A_TRADER: new Error('Not a trader'),
        ALREADY_A_TRADER: new Error('Already a trader')
    };
    static collection = global.mongoClient.db('RHSX').collection('Traders');
    static changedDocuments = new Set();
    static cache = new Collection();

    static async load() {
        const startTime = new Date();
        this.cache.clear();
        (await this.collection.find().toArray()).forEach(trader => {
            this.cache.set(trader._id, new Trader(trader));
        });
        console.log(`Cached ${this.cache.size} Trader(s), took ${new Date()-startTime}ms`);
    }

    static getTrader(_id) {
        const res = this.cache.get(_id);
        if(res == undefined) throw this.ERROR.NOT_A_TRADER;
        return res;
    }

    static getTraders() {
        return Array.from(this.cache.values());
    }

    constructor(args) {
        this._id = args._id;
        this.balance = args.balance ?? Trader.DEFAULT_STARTING_BALANCE;
        const Position = require('./Position');
        this.positions = args.positions ?? {};
        for(const pos in this.positions) this.positions[pos] = new Position(this.positions[pos]);
        this.joined = args.joined ?? new Date();
        this.costPerOrderSubmitted = args.costPerOrderSubmitted ?? Trader.DEFAULT_COST_PER_ORDER_SUBMITTED;
        this.costPerShareTraded = args.costPerShareTraded ?? Trader.DEFAULT_COST_PER_SHARE_TRADED;
        this.minPositionLimit = args.minPositionLimit ?? Trader.DEFAULT_MIN_POSITION_LIMIT;
        this.maxPositionLimit = args.maxPositionLimit ?? Trader.DEFAULT_MAX_POSITION_LIMIT;
    }

    async infoEmbed() {
        const embed = (await this.templateEmbed())
            .setTitle('Trader Info')
            .addFields(
                { name: 'Account Value', value: Price.format(this.getAccountValue()), inline: true },
                { name: 'Cash Balance', value: Price.format(this.balance), inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: 'Lower Position Limit', value: `${this.minPositionLimit}`, inline: true },
                { name: 'Upper Position Limit', value: `${this.maxPositionLimit}`, inline: true },
                { name: 'Joined', value: Tools.dateStr(this.joined), inline: false }
            );
        return embed;
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
            embed.addFields(
                { name: position.ticker, value: Price.format(price), inline: true },
                { name: Price.format(price*position.quantity), value: `**${position.quantity}**`, inline: true },
                { name: Price.format(position.calculateOpenPnL()), value: '\u200B', inline: true },
            );
        }
        return embed;
    }

    async templateEmbed() {
        const { MessageEmbed } = require('discord.js');
        return new MessageEmbed()
            .setAuthor({ name: (await this.getDiscordUser()).tag })
            .setColor('#3ba55d');
    }

    async getDiscordUser() {
        return await global.discordClient.users.fetch(this._id);
    }

    getAccountValue() {
        const Ticker = require('./Ticker');
        let accountValue = this.balance;
        for(const pos in this.positions) {
            accountValue += this.positions[pos].quantity*(Ticker.getTicker(pos).lastTradedPrice);
        }
        return accountValue;
    }

    toDBObject() {
        const obj = new Trader(this);
        return obj;
    }

    increaseBalance(amount) {
        this.balance += amount;
        Trader.changedDocuments.add(this);
    }

    addPosition(pos) {
        if(this.positions[pos.ticker] == undefined) this.positions[pos.ticker] = pos;
        else {
            const currPos = this.positions[pos.ticker];
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
        this.balance -= Math.abs(pos.quantity)*this.costPerShareTraded;
        if(this.positions[pos.ticker].quantity == 0) delete this.positions[pos.ticker];
        Trader.changedDocuments.add(this);
    }
};
