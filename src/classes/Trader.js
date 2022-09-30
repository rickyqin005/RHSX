const Price = require('../utils/Price');
const Tools = require('../utils/Tools');
const { Collection } = require('discord.js');

module.exports = class Trader {
    static ERROR = {
        NOT_A_TRADER: new Error('Not a trader'),
        ALREADY_A_TRADER: new Error('Already a trader')
    };
    static collection = global.mongoClient.db('RHSX').collection('Traders');
    static changedDocuments = new Set();
    static cache = new Collection();

    static assignOrderType(trader) {
        return new Trader(trader);
    }

    static initialize() {}

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
        this.balance = args.balance ?? global.market.defaultStartingBalance;
        this.positions = args.positions ?? [];
        this.joined = args.joined ?? new Date();
        this.costPerOrderSubmitted = args.costPerOrderSubmitted ?? global.market.defaultCostPerOrderSubmitted;
        this.costPerShareTraded = args.costPerShareTraded ?? global.market.defaultCostPerShareTraded;
        this.minPositionLimit = args.minPositionLimit ?? global.market.defaultMinPositionLimit;
        this.maxPositionLimit = args.maxPositionLimit ?? global.market.defaultMaxPositionLimit;
    }

    resolve() {
        const Ticker = require('./Ticker');
        const Position = require('./Position');
        const positions = this.positions;
        this.positions = new Map();
        for(const position of positions) {
            this.positions.set(Ticker.getTicker(position.ticker), new Position(position).resolve());
        }
        return this;
    }

    toDBObject() {
        const obj = Object.assign({}, this);
        obj.positions = Array.from(obj.positions.values()).map(position => position.toDBObject());
        return obj;
    }

    async templateEmbed() {
        const { MessageEmbed } = require('discord.js');
        return new MessageEmbed()
            .setAuthor({ name: (await this.getDiscordUser()).tag })
            .setColor('#3ba55d');
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
        for(const position of this.positions.values()) {
            const price = position.ticker.lastTradedPrice;
            embed.addFields(
                { name: position.ticker._id, value: Price.format(price), inline: true },
                { name: Price.format(price*position.quantity), value: `**${position.quantity}**`, inline: true },
                { name: Price.format(position.calculateOpenPnL()), value: '\u200B', inline: true },
            );
        }
        return embed;
    }

    async getDiscordUser() {
        return await global.discordClient.users.fetch(this._id);
    }

    getAccountValue() {
        let accountValue = this.balance;
        for(const position of this.positions.values()) accountValue += position.calculateMarketValue();
        return accountValue;
    }

    increaseBalance(amount) {
        this.balance += amount;
        Trader.changedDocuments.add(this);
    }

    addPosition(pos) {
        if(this.positions.get(pos.ticker) == undefined) this.positions.set(pos.ticker, pos);
        else {
            const currPos = this.positions.get(pos.ticker);
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
        this.increaseBalance(-pos.costBasis);
        this.increaseBalance(-Math.abs(pos.quantity)*this.costPerShareTraded);
        if(this.positions.get(pos.ticker).quantity == 0) this.positions.delete(pos.ticker);
        Trader.changedDocuments.add(this);
    }
};
