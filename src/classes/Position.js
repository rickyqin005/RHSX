module.exports = class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity ?? 0;
        this.costBasis = args.costBasis ?? 0;
    }

    resolve() {
        const Ticker = require('./Ticker');
        this.ticker = Ticker.getTicker(this.ticker);
    }

    calculateMarketValue() {
        return this.quantity*this.ticker.lastTradedPrice;
    }

    calculateOpenPnL() {
        return this.ticker.lastTradedPrice*this.quantity - this.costBasis;
    }
};
