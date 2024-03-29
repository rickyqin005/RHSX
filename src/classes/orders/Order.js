const Tools = require('../../utils/Tools');
const { Collection } = require('discord.js');
const { SlashCommandStringOption } = require('@discordjs/builders');
const { ObjectId } = require('mongodb');

module.exports = class Order {
    static BUY = 'BUY';
    static SELL = 'SELL';
    static CANCELLED = -1;
    static UNSUBMITTED = 0;
    static SUBMITTED = 1;
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
        ORDER_NOT_FOUND: new Error('Order not found'),
        NOT_SUBMITTED: new Error('Order is not submitted'),
        ALREADY_SUBMITTED: new Error('Order is already submitted')
    };
    static collection = global.mongoClient.db('RHSX').collection('Orders');
    static changedDocuments = new Set();
    static cache = new Collection();

    static assignOrderType(order) {
        const LimitOrder = require('./LimitOrder');
        const MarketOrder = require('./MarketOrder');
        const StopOrder = require('./StopOrder');
        if(order.type == LimitOrder.TYPE) return new LimitOrder(order);
        else if(order.type == MarketOrder.TYPE) return new MarketOrder(order);
        else if(order.type == StopOrder.TYPE) return new StopOrder(order);
    }

    static initialize() {
        const Ticker = require('../Ticker');
        Ticker.getTickers().forEach(ticker => this.TICKER_CHOICES.push({ name: ticker._id, value: ticker._id }));
    }

    static getOrder(_id) {
        const res = this.cache.get(_id);
        if(res == undefined) throw this.ORDER_NOT_FOUND;
        return res;
    }

    static getOrders() {
        return Array.from(this.cache.values());
    }

    static async queryOrder(query) {
        // const startTime = new Date();
        const res = await this.collection.findOne(query);
        // console.log(`Order.queryOrder(${String(JSON.stringify(query)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
        return (res != null ? this.cache.get(res._id) : undefined);
    }

    static async queryOrders(query, sort) {
        // const startTime = new Date();
        const res = await this.collection.find(query).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = this.cache.get(res[i]._id);
        // console.log(`Order.queryOrders(${String(JSON.stringify(query)).replace(/\n/g, " ")}, ${String(JSON.stringify(sort)).replace(/\n/g, " ")}), took ${new Date()-startTime}ms`);
        return res;
    }

    constructor(args) {
        this._id = args._id ?? ObjectId().toHexString();
        this.type = args.type;
        this.timestamp = args.timestamp ?? new Date();
        this.user = args.user;
        this.direction = args.direction;
        this.ticker = args.ticker;
        this.status = args.status ?? Order.UNSUBMITTED;
        this.cancelledReason = args.cancelledReason ?? undefined;
    }

    deserialize() {
        const Trader = require('../Trader');
        const Ticker = require('../Ticker');
        this.user = Trader.getTrader(this.user);
        this.ticker = Ticker.getTicker(this.ticker);
        return this;
    }

    serialize() {
        const obj = Object.assign({}, this);
        obj.user = obj.user._id;
        obj.ticker = obj.ticker._id;
        return obj;
    }

    label() {}

    statusLabel() {
        if(this.status == Order.CANCELLED) return 'Cancelled';
        else if(this.status == Order.UNSUBMITTED) return 'Unsubmitted';
        else if(this.status == Order.SUBMITTED) return 'Submitted';
        else if(this.status == Order.NOT_FILLED) return 'Pending';
        else if(this.status == Order.PARTIALLY_FILLED) return 'Pending';
        else if(this.status == Order.COMPLETELY_FILLED) return 'Completed';
    }

    toInfoString() {}

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

    setStatus(newStatus, cancelledReason) {
        if(!(Order.CANCELLED <= newStatus && newStatus <= Order.COMPLETELY_FILLED)) throw new Error('Invalid status');
        if(newStatus == this.status) return;
        this.status = newStatus;
        this.cancelledReason = cancelledReason;
        Order.changedDocuments.add(this);
    }

    validate() {}

    async violatesPositionLimits() {
        return false;
    }

    submit(hasOrderSubmissionFee = true) {
        if(this.status != Order.UNSUBMITTED) throw Order.ERROR.ALREADY_SUBMITTED;
        this.validate();
        this.timestamp = new Date();
        Order.changedDocuments.add(this);
        this.setStatus(Order.SUBMITTED);
        if(hasOrderSubmissionFee) this.user.increaseBalance(-this.user.costPerOrderSubmitted);
    }

    async process() {
        if(this.status != Order.SUBMITTED) throw Order.ERROR.NOT_SUBMITTED;
        this.timestamp = new Date();
        if(await this.violatesPositionLimits()) {
            this.cancel(Order.VIOLATES_POSITION_LIMITS); return false;
        }
        this.setStatus(Order.NOT_FILLED);
        return true;
    }

    cancel(cancelledReason) {
        if(this.status == Order.CANCELLED) throw new Error('Order is already cancelled');
        if(this.status == Order.COMPLETELY_FILLED) throw new Error('Order is already completed');
        this.setStatus(Order.CANCELLED, cancelledReason);
    }
};
