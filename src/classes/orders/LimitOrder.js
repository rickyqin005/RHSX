const NormalOrder = require('./NormalOrder');
const Order = require('./Order');
const Price = require('../../utils/Price');
const { SlashCommandNumberOption } = require('@discordjs/builders');

module.exports = class LimitOrder extends NormalOrder {
    static TYPE = 'limit';
    static LABEL = 'limit order';
    static MIN_PRICE = Price.toPrice(0);
    static MAX_PRICE = Price.toPrice(1000000);
    static OPTION = {
        PRICE: function () {
            return new SlashCommandNumberOption()
                .setName('limit_price')
                .setDescription('limit price')
                .setMinValue(Price.toNumber(LimitOrder.MIN_PRICE))
                .setMaxValue(Price.toNumber(LimitOrder.MAX_PRICE));
        }
    };

    constructor(args) {
        super(args);
        this.price = args.price;
    }

    label() {
        return LimitOrder.LABEL;
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
