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

    resolve() {
        super.resolve();
        this.executedOrder = Order.getOrder(this.executedOrder);
        return this;
    }

    toDBObject() {
        const obj = super.toDBObject();
        obj.executedOrder = obj.executedOrder._id;
        return obj;
    }

    label() {
        return StopOrder.LABEL;
    }

    toInfoString() {
        return `#${this._id}, ${this.ticker._id} @${Price.format(this.triggerPrice)}, ${this.executedOrder.toStopString()}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.ticker._id} @${Price.format(this.triggerPrice)}`, value: `**${this.executedOrder.toStopString()}**`, inline: true });
        return fields;
    }

    validate() {
        super.validate();
        if(this.executedOrder.direction == Order.BUY && !(this.ticker.lastTradedPrice < this.triggerPrice)) throw new Error('Trigger price must be greater than the current price');
        if(this.executedOrder.direction == Order.SELL && !(this.triggerPrice < this.ticker.lastTradedPrice)) throw new Error('Trigger price must be less than the current price');
    }

    submit() {
        super.submit();
        this.executedOrder.submit(false);
    }
};
