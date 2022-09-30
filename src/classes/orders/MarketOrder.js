const NormalOrder = require('./NormalOrder');
const Order = require('./Order');

module.exports = class MarketOrder extends NormalOrder {
    static TYPE = 'market';
    static LABEL = 'market order';

    constructor(args) {
        super(args);
    }

    label() {
        return MarketOrder.LABEL;
    }

    toInfoString() {
        return `#${this._id}, ${this.direction} x${this.quantity} ${this.ticker._id}`;
    }

    toStopString() {
        return `${this.direction} x${this.quantity}`;
    }

    toOrderQueryEmbedFields() {
        const fields = super.toOrderQueryEmbedFields();
        fields.push({ name: `${this.direction} x${this.quantity} ${this.ticker._id}`, value: `**(x${this.quantityFilled} filled)**`, inline: true });
        return fields;
    }

    async fill() {
        let newLastTradedPrice = this.ticker.lastTradedPrice;
        if(this.direction == Order.BUY) {
            const asks = await this.ticker.getAsks();
            let asksDepth = 0;
            asks.forEach(ask => asksDepth += ask.getQuantityUnfilled());
            if(this.quantity > asksDepth) {
                this.cancel(Order.UNFULFILLABLE); return;
            }
            for(const bestAsk of asks) {
                if(this.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = this.match(bestAsk).price;
            }
        } else if(this.direction == Order.SELL) {
            const bids = await this.ticker.getBids();
            let bidsDepth = 0;
            bids.forEach(bid => bidsDepth += bid.getQuantityUnfilled());
            if(this.quantity > bidsDepth) {
                this.cancel(Order.UNFULFILLABLE); return;
            }
            for(const bestBid of bids) {
                if(this.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = this.match(bestBid).price;
            }
        }
        await this.ticker.setLastTradedPrice(newLastTradedPrice);
    }
}
