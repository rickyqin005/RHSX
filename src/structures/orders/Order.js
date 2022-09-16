const Tools = require('../../utils/Tools');
const { Collection } = require('discord.js');

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
    static CANCELLED_BY_TRADER = 2;

    static collection = global.mongoClient.db('RHSX').collection('Orders');
    static cache = new Collection();

    static async loadCache() {
        const startTime = new Date();
        this.cache.clear();
        const orders = await this.collection.find({}).limit(50000).toArray();
        for(const order of orders) this.cache.set(order._id, this.assignOrderType(order));
        for(const [id, order] of this.cache) await order.resolve();
        console.log(`Cached ${this.cache.size} Order(s), took ${new Date()-startTime}ms`);
    }

    static assignOrderType(order) {
        const LimitOrder = require('./LimitOrder');
        const MarketOrder = require('./MarketOrder');
        const StopOrder = require('./StopOrder');
        if(order.type == LimitOrder.TYPE) return new LimitOrder(order);
        else if(order.type == MarketOrder.TYPE) return new MarketOrder(order);
        else if(order.type == StopOrder.TYPE) return new StopOrder(order);
    }

    static async getOrder(_id) {
        // const startTime = new Date();
        let res = this.cache.get(_id);
        if(res == undefined) {
            res = await this.collection.findOne({ _id: _id });
            if(res != null) {
                res = await this.assignOrderType(res).resolve();
                this.cache.set(_id, res);
            }
        }
        // console.log(`Order.getOrder(${_id}), took ${new Date()-startTime}ms`);
        return res;
    }

    static async queryOrder(query) {
        // const startTime = new Date();
        let res = await this.collection.findOne(query);
        const resOrig = res;
        res = this.cache.get(resOrig._id);
        if(res == undefined) {
            res = await this.assignOrderType(resOrig).resolve();
            this.cache.set(res._id, res);
        }
        // console.log(`Order.queryOrder(${String(JSON.stringify(query)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
        return res;
    }

    static async queryOrders(query, sort) {
        // const startTime = new Date();
        let res = await this.collection.find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) {
            const resOrig = res[i];
            res[i] = this.cache.get(resOrig._id);
            if(res[i] == undefined) {
                res[i] = await this.assignOrderType(resOrig).resolve();
                this.cache.set(res[i]._id, res[i]);
            }
        }
        // console.log(`Order.queryOrders(${String(JSON.stringify(query)).replace(/\n/g, " ")}, ${String(JSON.stringify(sort)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
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
        this.statusReason = args.statusReason;
    }

    async resolve() {
        const Trader = require('../Trader');
        const Ticker = require('../Ticker');
        this.user = Trader.getTrader(this.user);
        this.ticker = Ticker.getTicker(this.ticker);
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

    orderCancelledString() {
        switch(this.statusReason) {
            case Order.UNFULFILLABLE:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it cannot be fulfilled.`;
            case Order.VIOLATES_POSITION_LIMITS:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled because it violates your position limits.`;
            default:
                return `Your ${this.label}: \`${this.toInfoString()}\` is cancelled.`;
        }
    }

    statusString() {
        if(this.status == Order.IN_QUEUE) return this.orderSubmittedString();
        else if(this.status == Order.CANCELLED) return this.orderCancelledString();
        else return this.orderSubmittedString();// default message for now
    }

    async setStatus(newStatus, mongoSession, reason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status');
        if(newStatus == this.status) return;
        this.status = newStatus;
        this.statusReason = reason;
        await Order.collection.updateOne({ _id: this._id }, { $set: { status: newStatus, statusReason: reason } }, { session: mongoSession });
    }

    async addToDB(mongoSession) {
        const trader = this.user;
        const ticker = this.ticker;
        this.user = this.user._id;
        this.ticker = this.ticker._id;
        await Order.collection.insertOne(this, { session: mongoSession });
        this.user = trader;
        this.ticker = ticker;
    }

    async checkPositionLimits(mongoSession) {
        return this.status;
    }

    async submit(mongoSession) {
        this.timestamp = new Date();
        await this.addToDB(mongoSession);
        console.log(this);
        if((await this.checkPositionLimits(mongoSession)) == Order.CANCELLED) return;
        await this.setStatus(Order.IN_QUEUE, mongoSession);
        await this.fill(mongoSession);
    }

    async fill(mongoSession) {
        await this.setStatus(Order.NOT_FILLED, mongoSession);
    }

    async cancel(reason, mongoSession) {
        if(this.status == Order.CANCELLED) throw new Error('Order is already cancelled');
        if(this.status == Order.COMPLETELY_FILLED) throw new Error('Order is already filled');
        await this.setStatus(Order.CANCELLED, mongoSession, reason);
    }
};
