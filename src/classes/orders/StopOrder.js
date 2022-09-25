const Order = require('./Order');
const Price = require('../../utils/Price');
const { SlashCommandNumberOption } = require('@discordjs/builders');

module.exports = class StopOrder extends Order {
    static TYPE = 'stop';
    static LABEL = 'stop order';
    static MIN_TRIGGER_PRICE = Price.toPrice(0);
    static MAX_TRIGGER_PRICE = Price.toPrice(1000000);
    static OPTION = {
        TRIGGER_PRICE: function () {
            return new SlashCommandNumberOption()
                .setName('trigger_price')
                .setDescription('trigger price')
                .setMinValue(Price.toNumber(StopOrder.MIN_TRIGGER_PRICE))
                .setMaxValue(Price.toNumber(StopOrder.MAX_TRIGGER_PRICE));
        }
    };

    constructor(args) {
        super(args);
        this.triggerPrice = args.triggerPrice;
        this.executedOrder = args.executedOrder;
    }

    label() {
        return StopOrder.LABEL;
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
        if(this.executedOrder.direction == Order.BUY && !(this.ticker.lastTradedPrice < this.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
        if(this.executedOrder.direction == Order.SELL && !(this.triggerPrice < this.ticker.lastTradedPrice)) throw new Error('Trigger price must be less than the current price');
    }

    toDBObject() {
        const obj = Order.assignOrderType(this);
        obj.user = obj.user._id;
        obj.ticker = obj.ticker._id;
        obj.executedOrder.user = obj.executedOrder.user._id;
        obj.executedOrder.ticker = obj.executedOrder.ticker._id;
        return obj;
    }
};
