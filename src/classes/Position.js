module.exports = class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity ?? 0;
        this.costBasis = args.costBasis ?? 0;
    }

    async calculateOpenPnL() {
        const Ticker = require('./Ticker');
        return Ticker.getTicker(this.ticker).lastTradedPrice*this.quantity - this.costBasis;
    }
};
