const NormalOrder = require('./NormalOrder');
const Order = require('./Order');
const Price = require('../../utils/Price');

module.exports = class LimitOrder extends NormalOrder {
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

    async fill() {
        await super.fill();
        let newLastTradedPrice = this.ticker.lastTradedPrice;
        if(this.direction == Order.BUY) {
            const asks = await this.ticker.getAsks();
            for(const bestAsk of asks) {
                if(this.status == Order.COMPLETELY_FILLED || this.price < bestAsk.price) break;
                newLastTradedPrice = (await this.match(bestAsk)).price;
            }
        } else if(this.direction == Order.SELL) {
            const bids = await this.ticker.getBids();
            for(const bestBid of bids) {
                if(this.status == Order.COMPLETELY_FILLED || bestBid.price < this.price) break;
                newLastTradedPrice = (await this.match(bestBid)).price;
            }
        }
        await this.ticker.setLastTradedPrice(newLastTradedPrice);
    }
};
