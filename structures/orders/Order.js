const Tools = require('../../utils/Tools');

module.exports = class Order {
    static BUY = 'BUY';
    static SELL = 'SELL';
    static CANCELLED = -1;
    static UNSUBMITTED = 0;
    static IN_QUEUE = 1;
    static NOT_FILLED = 2;
    static PARTIALLY_FILLED = 3;
    static COMPLETELY_FILLED = 4;
    static UNFULFILLABLE = 0;
    static VIOLATES_POSITION_LIMITS = 1;

    static collection = global.mongoClient.db('RHSX').collection('Orders');

    static async assignOrderType(order) {
        const LimitOrder = require('./LimitOrder');
        const MarketOrder = require('./MarketOrder');
        const StopOrder = require('./StopOrder');
        if(order.type == LimitOrder.TYPE) return await new LimitOrder(order).resolve();
        else if(order.type == MarketOrder.TYPE) return await new MarketOrder(order).resolve();
        else if(order.type == StopOrder.TYPE) return await new StopOrder(order).resolve();
    }

    static async getOrder(_id) {
        let res = await this.collection.findOne({ _id: _id }, global.current.mongoSession);
        if(res != null) res = await this.assignOrderType(res);
        return res;
    }

    static async queryOrder(query) {
        let res = await this.collection.findOne(query, global.current.mongoSession);
        if(res != null) res = await this.assignOrderType(res);
        return res;
    }

    static async queryOrders(query, sort) {
        let res = await this.collection.find(query, global.current.mongoSession).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = await this.assignOrderType(res[i]);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.type = args.type;
        this.timestamp = args.timestamp;
        this.user = args.user;
        this.direction = args.direction;
        this.ticker = args.ticker;
        this.status = args.status;
    }

    async resolve() {
        const Trader = require('../Trader');
        const Ticker = require('../Ticker');
        this.user = await Trader.getTrader(this.user);
        this.ticker = await Ticker.getTicker(this.ticker);
        return this;
    }

    statusLabel() {
        if(this.status == Order.CANCELLED) return 'Cancelled';
        else if(this.status == Order.UNSUBMITTED) return 'Unsubmitted';
        else if(this.status == Order.IN_QUEUE) return 'In queue';
        else if(this.status == Order.NOT_FILLED) return 'Pending';
        else if(this.status == Order.PARTIALLY_FILLED) return 'Pending';
        else if(this.status == Order.COMPLETELY_FILLED) return 'Completed';
    }

    toDisplayBoardString() {}

    toInfoString() {}

    async toEmbed() {
        const { MessageEmbed } = require('discord.js');
        return new MessageEmbed()
            .setAuthor({ name: (await this.user.getDiscordUser()).tag })
            .setColor('#3ba55d')
            .setTitle('Order Info')
            .setDescription(`**${this.toInfoString()}**`)
            .addFields(
                { name: 'Type', value: this.label, inline: true },
                { name: 'Status', value: this.statusLabel(), inline: true },
                { name: 'Submitted', value: Tools.dateStr(this.timestamp), inline: false }
            );
    }

    toOrderQueryEmbedFields() {
        return [
            { name: this.type.toUpperCase(), value: this.statusLabel(), inline: true },
            { name: Tools.dateStr(this.timestamp), value: `#${this._id}`, inline: true }
        ];
    }

    orderSubmittedString() {
        return `Your ${this.label}: \`${this.toInfoString()}\` is submitted.`;
    }

    orderCancelledString(reason) {
        switch(reason) {
            case Order.UNFULFILLABLE:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled.`;
        }
    }

    async setStatus(newStatus, reason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status');
        if(newStatus == this.status) return;

        this.status = newStatus;
        await Order.collection.updateOne({ _id: this._id }, { $set: { status: newStatus } }, global.current.mongoSession);
        if(global.current.order.equals(this._id)) {
            if(newStatus == Order.IN_QUEUE) global.current.interaction.editReply(this.orderSubmittedString());
            else if(newStatus == Order.CANCELLED) global.global.current.interaction.editReply(this.orderCancelledString(reason));
        }
    }

    async addToDB() {
        const trader = this.user;
        const ticker = this.ticker;
        this.user = this.user._id;
        this.ticker = this.ticker._id;
        await Order.collection.insertOne(this, global.current.mongoSession);
        this.user = trader;
        this.ticker = ticker;
    }

    async checkPositionLimits() {
        return this.status;
    }

    async submit() {
        this.timestamp = new Date();
        await this.addToDB();
        console.log('Submitted order:');
        console.log(this);
        if((await this.checkPositionLimits()) == Order.CANCELLED) return;
        await this.setStatus(Order.IN_QUEUE);
        await this.fill();
    }

    async fill() {
        await this.setStatus(Order.NOT_FILLED);
    }

    async cancel(reason) {
        if(this.status == Order.CANCELLED) throw new Error('Order is already cancelled');
        if(this.status == Order.COMPLETELY_FILLED) throw new Error('Order is already filled');
        await this.setStatus(Order.CANCELLED, reason);
    }
};
