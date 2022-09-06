const Order = require('./Order');
const Position = require('../Position');

module.exports = class NormalOrder extends Order {
    constructor(args) {
        super(args);
        this.quantity = args.quantity;
        this.quantityFilled = args.quantityFilled;
        this.netPositionChangeSign = ((this.direction == Order.BUY) ? 1 : -1);
    }

    toStopString() {}

    getQuantityUnfilled() {
        return this.quantity - this.quantityFilled;
    }

    async increaseQuantityFilled(amount, price) {
        this.quantityFilled += amount;
        await Order.collection.updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } }, global.current.mongoSession);

        if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED);
        else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED);
        await (await Trader.getTrader(this.user)).addPosition(new Position({
            ticker: this.ticker,
            quantity: amount*this.netPositionChangeSign,
            costBasis: amount*this.netPositionChangeSign*price
        }));
    }
};
