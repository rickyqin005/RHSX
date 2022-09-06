const NormalOrder = require('./NormalOrder');
const Order = require('./Order');

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
Order.orderSubclasses[MarketOrder.TYPE] = (order) => (order.type == MarketOrder.TYPE ? new MarketOrder(order) : null);

module.exports = MarketOrder;
