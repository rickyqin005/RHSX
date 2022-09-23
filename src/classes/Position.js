module.exports = class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity;
        this.costBasis = args.costBasis;
    }

    async calculateOpenPnL() {
        const Ticker = require('./Ticker');
        return Ticker.getTicker(this.ticker).lastTradedPrice*this.quantity - this.costBasis;
    }
};
