const Price = require('../utils/Price');
const Tools = require('../utils/Tools');

class Order {
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

    static assignOrderType(order) {
        if(order.type == LimitOrder.TYPE) return new LimitOrder(order);
        else if(order.type == MarketOrder.TYPE) return new MarketOrder(order);
        else if(order.type == StopOrder.TYPE) return new StopOrder(order);
    }
    static async getOrder(_id) {
        let res = await this.collection.findOne({ _id: _id }, global.current.mongoSession);
        if(res != null) res = this.assignOrderType(res);
        return res;
    }
    static async queryOrder(query) {
        let res = await this.collection.findOne(query, global.current.mongoSession);
        if(res != null) res = this.assignOrderType(res);
        return res;
    }
    static async queryOrders(query, sort) {
        let res = await this.collection.find(query, global.current.mongoSession).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = this.assignOrderType(res[i]);
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
        return new MessageEmbed()
            .setAuthor({ name: (await global.discordClient.users.fetch(this.user)).tag })
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
        if(global.current.interaction != null && global.current.order.equals(this._id)) {
            if(newStatus == Order.IN_QUEUE) global.current.interaction.editReply(this.orderSubmittedString());
            else if(newStatus == Order.CANCELLED) global.global.current.interaction.editReply(this.orderCancelledString(reason));
        }
    }
}

class NormalOrder extends Order {
    constructor(args) {
        super(args);
        this.quantity = args.quantity;
        this.quantityFilled = args.quantityFilled;
        this.netPositionChangeSign = ((this.direction == Order.BUY) ? 1 : -1);
    }

    toStopString() {}

    getQuantityUnfilled() {
        return this.quantity - this.quantityFilled;
    }

    async increaseQuantityFilled(amount, price) {
        this.quantityFilled += amount;
        await Order.collection.updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } }, global.current.mongoSession);

        if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED);
        else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED);
        await (await Trader.getTrader(this.user)).addPosition(new Position({
            ticker: this.ticker,
            quantity: amount*this.netPositionChangeSign,
            costBasis: amount*this.netPositionChangeSign*price
        }));
    }
}

class LimitOrder extends NormalOrder {
    static TYPE = 'limit';
    static LABEL = 'limit order';

    constructor(args) {
        super(args);
        this.price = args.price;
        this.type = LimitOrder.TYPE;
        this.label = LimitOrder.LABEL;
    }

    toDisplayBoardString() {
        return `@${Price.format(this.price)} x${this.getQuantityUnfilled()}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker} @${Price.format(this.price)}`;
    }

    toStopString() {
        return `${this.direction} x${this.quantity} @${Price.format(this.price)}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.direction} x${this.quantity} ${this.ticker} @${Price.format(this.price)}`, value: `**(x${this.quantityFilled} filled)**`, inline: true });
        return fields;
    }
}

class MarketOrder extends NormalOrder {
    static TYPE = 'market';
    static LABEL = 'market order';

    constructor(args) {
        super(args);
        this.type = MarketOrder.TYPE;
        this.label = MarketOrder.LABEL;
    }

    toDisplayBoardString() {
        return `x${this.quantity}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker}`;
    }

    toStopString() {
        return `${this.direction} x${this.quantity}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.direction} x${this.quantity} ${this.ticker}`, value: `**(x${this.quantityFilled} filled)**`, inline: true });
        return fields;
    }
}

class StopOrder extends Order {
    static TYPE = 'stop';
    static LABEL = 'stop order';

    constructor(args) {
        super(args);
        this.triggerPrice = args.triggerPrice;
        if(args.executedOrder.type == LimitOrder.TYPE) this.executedOrder = new LimitOrder(args.executedOrder);
        else if(args.executedOrder.type == MarketOrder.TYPE) this.executedOrder = new MarketOrder(args.executedOrder);
        this.type = StopOrder.TYPE;
        this.label = StopOrder.LABEL;
    }

    toDisplayBoardString() {
        return `@${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    toInfoString() {
        return `#${this._id}, ${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}`, value: `**${this.executedOrder.toStopString()}**`, inline: true });
        return fields;
    }
}

module.exports = { Order: Order, NormalOrder: NormalOrder, LimitOrder: LimitOrder, MarketOrder: MarketOrder, StopOrder: StopOrder };