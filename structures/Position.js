module.exports = class Position {
    constructor(args) {
        this.ticker = args.ticker;
        this.quantity = args.quantity;
        this.costBasis = args.costBasis;
    }
};