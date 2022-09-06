const Order = require('./Order');
const LimitOrder = require('./LimitOrder');
const MarketOrder = require('./MarketOrder');
const Price = require('../../utils/Price');

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
Order.orderSubclasses[StopOrder.TYPE] = (order) => (order.type == StopOrder.TYPE ? new StopOrder(order) : null);

module.exports = StopOrder;
