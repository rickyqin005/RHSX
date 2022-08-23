const Position = require('./Position');
const { Order } = require('./Orders');
const Price = require('../utils/Price');
const { MessageEmbed } = require('discord.js');

module.exports = class Trader {
    static DEFAULT_POSITION_LIMIT = 100000;
    static collection = global.mongoClient.db('RHSX').collection('Traders');

    static async getTrader(_id) {
        let res = await this.collection.findOne({ _id: _id }, global.current.mongoSession);
        if(res != null) res = new Trader(res);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.positionLimit = args.positionLimit;
        this.balance = args.balance;
        this.positions = {};
        for(const pos in args.positions) this.positions[pos] = new Position(args.positions[pos]);
    }

    async toString() {
        let accountValue = this.balance;
        for(const pos in this.positions) {
            accountValue += this.positions[pos].quantity*(await orderBook.getLastTradedPrice(pos));
        }
        const traderInfoEmbed = (await this.templateEmbed())
            .setTitle('Trader Info')
            .addFields(
                { name: 'Account Value', value: Price.format(accountValue), inline: true },
                { name: 'Cash Balance', value: Price.format(this.balance), inline: true },
            );

        const positionsEmbed = (await this.templateEmbed())
            .setTitle('Positions')
            .addFields(
                { name: '\u200B', value: '**Symbol/Price**', inline: true },
                { name: '\u200B', value: '**Mkt Value/Quantity**', inline: true },
                { name: '\u200B', value: '**Open P&L**', inline: true },
            );
        for(const pos in this.positions) {
            const position = this.positions[pos];
            const price = await orderBook.getLastTradedPrice(pos);
            if(position.quantity == 0) continue;
            positionsEmbed.addFields(
                { name: position.ticker, value: Price.format(price), inline: true },
                { name: Price.format(price*position.quantity), value: position.quantity.toString(), inline: true },
                { name: Price.format(await this.calculateOpenPnL(position)), value: '\u200B', inline: true },
            );
        }
        return { embeds: [traderInfoEmbed, positionsEmbed] };
    }

    async templateEmbed() {
        return new MessageEmbed()
            .setAuthor({ name: (await global.discordClient.users.fetch(this._id)).tag })
            .setColor('#3ba55d');
    }

    async getPendingOrders(/*add optional parameter for order type*/) {
        return await Order.queryOrders({
            user: this._id,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, { timestamp: -1 });
    }

    async addPosition(pos) {
        let currPos = this.positions[pos.ticker];
        if(currPos == undefined) currPos = pos;
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
        await Trader.collection.updateOne({ _id: this._id }, { $set: { [`positions.${pos.ticker}`]: currPos, balance: this.balance } }, global.current.mongoSession);
    }

    async calculateOpenPnL(position) {
        return (await orderBook.getLastTradedPrice(position.ticker))*position.quantity - position.costBasis;
    }
};