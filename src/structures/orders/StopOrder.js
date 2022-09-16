const Order = require('./Order');
const Price = require('../../utils/Price');

module.exports = class StopOrder extends Order {
    static TYPE = 'stop';
    static LABEL = 'stop order';

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
    }
};
