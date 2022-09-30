module.exports = class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity ?? 0;
        this.costBasis = args.costBasis ?? 0;
    }

    resolve() {
        const Ticker = require('./Ticker');
        this.ticker = Ticker.getTicker(this.ticker);
        return this;
    }

    toDBObject() {
        const obj = Object.assign({}, this);
        obj.ticker = obj.ticker._id;
        return obj;
    }

    calculateMarketValue() {
        return this.quantity*this.ticker.lastTradedPrice;
    }

    calculateOpenPnL() {
        return this.ticker.lastTradedPrice*this.quantity - this.costBasis;
    }
};
