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

    async fill(mongoSession) {
        await super.fill(mongoSession);
        let newLastTradedPrice = this.ticker.lastTradedPrice;
        if(this.direction == Order.BUY) {
            const asks = await this.ticker.getAsks();
            let asksDepth = 0;
            asks.forEach(ask => asksDepth += ask.getQuantityUnfilled());
            if(this.quantity > asksDepth) {
                await this.cancel(Order.UNFULFILLABLE, mongoSession); return;
            }
            for(const bestAsk of asks) {
                if(this.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = (await this.match(bestAsk, mongoSession)).price;
            }
        } else if(this.direction == Order.SELL) {
            const bids = await this.ticker.getBids();
            let bidsDepth = 0;
            bids.forEach(bid => bidsDepth += bid.getQuantityUnfilled());
            if(this.quantity > bidsDepth) {
                await this.cancel(Order.UNFULFILLABLE, mongoSession); return;
            }
            for(const bestBid of bids) {
                if(this.status == Order.COMPLETELY_FILLED) break;
                newLastTradedPrice = (await this.match(bestBid, mongoSession)).price;
            }
        }
        await this.ticker.setLastTradedPrice(newLastTradedPrice, mongoSession);
    }
}
