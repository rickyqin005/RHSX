const Tools = require('../../utils/Tools');
const { Collection } = require('discord.js');
const { SlashCommandStringOption } = require('@discordjs/builders');
const { ObjectId } = require('mongodb');

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
    static TICKER_CHOICES = [];
    static OPTION = {
        ID: function () {
            return new SlashCommandStringOption()
                .setName('order_id')
                .setDescription('order id')
                .setMinLength(24)
                .setMaxLength(24);
        },
        TYPE: function () {
            return new SlashCommandStringOption()
                .setName('type')
                .setDescription('type')
                .addChoices(
                    { name: 'Limit Order', value: 'limit' },
                    { name: 'Market Order', value: 'market' },
                    { name: 'Stop Order', value: 'stop' }
                );
        },
        DIRECTION: function () {
            return new SlashCommandStringOption()
                .setName('direction')
                .setDescription('buy or sell')
                .addChoices(
                    { name: Order.BUY, value: Order.BUY },
                    { name: Order.SELL, value: Order.SELL }
                );
        },
        TICKER: function () {
            const res = new SlashCommandStringOption()
                .setName('ticker')
                .setDescription('ticker');
            Order.TICKER_CHOICES.forEach(ticker => res.addChoices(ticker));
            return res;
        },
        STATUS: function () {
            return new SlashCommandStringOption()
                .setName('status')
                .setDescription('status')
                .addChoices(
                    { name: 'Pending', value: 'pending' },
                    { name: 'Completed', value: 'completed' },
                    { name: 'Cancelled', value: 'cancelled' }
                );
        }
    };
    static ERROR = {
        ORDER_NOT_FOUND: new Error('Order not found')
    };
    static collection = global.mongoClient.db('RHSX').collection('Orders');
    static changedDocuments = new Set();
    static cache = new Collection();

    static async load() {
        const startTime = new Date();
        this.cache.clear();
        const orders = await this.collection.find().limit(100000).toArray();
        for(const order of orders) this.cache.set(order._id, this.assignOrderType(order));
        for(const [id, order] of this.cache) await order.resolve();
        const Ticker = require('../Ticker');
        Ticker.getTickers().forEach(ticker => this.TICKER_CHOICES.push({ name: ticker._id, value: ticker._id }));
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

    static async queryOrder(query) {
        // const startTime = new Date();
        let res = ((await this.collection.findOne(query)) ?? undefined);
        if(res != undefined) {
            const resOrig = res;
            res = this.cache.get(resOrig._id);
            if(res == undefined) {
                res = await this.assignOrderType(resOrig).resolve();
                this.cache.set(res._id, res);
            }
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
        this._id = args._id ?? ObjectId();
        this.type = args.type;
        this.timestamp = args.timestamp ?? new Date();
        this.user = args.user;
        this.direction = args.direction;
        this.ticker = args.ticker;
        this.status = args.status ?? Order.UNSUBMITTED;
        this.cancelledReason = args.cancelledReason ?? undefined;
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
                { name: 'Type', value: this.label(), inline: true },
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

    statusString() {
        let str = `Your ${this.label()}: \`${this.toInfoString()}\` is `;
        if(this.status == Order.CANCELLED) {
            if(this.cancelledReason == Order.UNFULFILLABLE) str += 'cancelled because it cannot be fulfilled';
            else if(this.cancelledReason == Order.VIOLATES_POSITION_LIMITS) str += 'cancelled because it violates your position limits'
            else str += 'cancelled';
        } else if(this.status == Order.COMPLETELY_FILLED) str += 'completed';
        else str += 'submitted';
        return str;
    }

    async setStatus(newStatus, mongoSession, cancelledReason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status');
        if(newStatus == this.status) return;
        this.status = newStatus;
        this.cancelledReason = cancelledReason;
        Order.changedDocuments.add(this);
    }

    validate() {
        this.timestamp = new Date();
    }

    toDBObject() {
        const obj = Order.assignOrderType(this);
        obj.user = obj.user._id;
        obj.ticker = obj.ticker._id;
        return obj;
    }

    async violatesPositionLimits(mongoSession) {
        return false;
    }

    async submit(orderSubmissionFee, mongoSession) {
        this.validate();
        Order.changedDocuments.add(this);
        Order.cache.set(this._id, this);
        if(orderSubmissionFee) await this.user.increaseBalance(-this.user.costPerOrderSubmitted, mongoSession);
        if(await this.violatesPositionLimits(mongoSession)) {
            this.cancel(Order.VIOLATES_POSITION_LIMITS, mongoSession); return;
        }
        await this.fill(mongoSession);
    }

    async fill(mongoSession) {
        await this.setStatus(Order.NOT_FILLED, mongoSession);
    }

    async cancel(cancelledReason, mongoSession) {
        if(this.status == Order.CANCELLED) throw new Error('Order is already cancelled');
        if(this.status == Order.COMPLETELY_FILLED) throw new Error('Order is already filled');
        await this.setStatus(Order.CANCELLED, mongoSession, cancelledReason);
    }
};
