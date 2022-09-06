const NormalOrder = require('./NormalOrder');
const Order = require('./Order');
const Price = require('../../utils/Price');

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
Order.orderSubclasses[LimitOrder.TYPE] = (order) => (order.type == LimitOrder.TYPE ? new LimitOrder(order) : null);

module.exports = LimitOrder;
