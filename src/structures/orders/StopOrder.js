const Order = require('./Order');
const Price = require('../../utils/Price');

module.exports = class StopOrder extends Order {
    static TYPE = 'stop';
    static LABEL = 'stop order';
    static MIN_TRIGGER_PRICE = Price.toPrice(0);
    static MAX_TRIGGER_PRICE = Price.toPrice(1000000);
    static ERROR = {
        TRIGGER_PRICE_TOO_LOW: new Error('Trigger price must be greater than the current price'),
        TRIGGER_PRICE_TOO_HIGH: new Error('Trigger price must be less than the current price')
    };

    constructor(args) {
        super(args);
        this.triggerPrice = args.triggerPrice;
        this.executedOrder = args.executedOrder;
        this.type = StopOrder.TYPE;
        this.label = StopOrder.LABEL;
    }

    async resolve() {
        await super.resolve();
        this.executedOrder = (Order.cache.get(this.executedOrder._id) ?? (await Order.assignOrderType(this.executedOrder).resolve()));
        return this;
    }

    toInfoString() {
        return `#${this._id}, ${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.executedOrder.ticker} @${Price.format(this.triggerPrice)}`, value: `**${this.executedOrder.toStopString()}**`, inline: true });
        return fields;
    }

    validate() {
        super.validate();
        if(this.executedOrder.direction == Order.BUY && !(this.ticker.lastTradedPrice < this.triggerPrice)) throw StopOrder.ERROR.TRIGGER_PRICE_TOO_LOW;
        if(this.executedOrder.direction == Order.SELL && !(this.triggerPrice < this.ticker.lastTradedPrice)) throw StopOrder.ERROR.TRIGGER_PRICE_TOO_HIGH;
    }

    async addToDB(mongoSession) {
        const trader = this.user;
        const ticker = this.ticker;
        this.user = this.user._id;
        this.ticker = this.ticker._id;
        this.executedOrder.user = this.executedOrder.user._id;
        this.executedOrder.ticker = this.executedOrder.ticker._id;
        await Order.collection.insertOne(this, { session: mongoSession });
        this.user = trader;
        this.ticker = ticker;
        this.executedOrder.user = trader;
        this.executedOrder.ticker = ticker;
        Order.cache.set(this._id, this);
    }
};
