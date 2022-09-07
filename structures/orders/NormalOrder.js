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
        await this.user.addPosition(new Position({
            ticker: this.ticker._id,
            quantity: amount*this.netPositionChangeSign,
            costBasis: amount*this.netPositionChangeSign*price
        }));
    }

    async match(existingOrder) {
        const Ticker = require('../Ticker');
        const quantity = Math.min(this.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        const price = existingOrder.price;
        await existingOrder.increaseQuantityFilled(quantity, price);
        await this.increaseQuantityFilled(quantity, price);
        await existingOrder.ticker.increaseVolume(quantity);
        return { quantity: quantity, price: price };
    }

    async checkPositionLimits() {
        const currPosition = this.user.positions[this.ticker._id];
        let extremePosition = (currPosition == undefined ? 0 : currPosition.quantity) + this.quantity;
        (await this.user.getPendingOrders()).forEach(pendingOrder => {
            if(pendingOrder instanceof NormalOrder) {
                if(this.netPositionChangeSign == pendingOrder.netPositionChangeSign) extremePosition += pendingOrder.quantity;
            }
        });
        if(Math.abs(extremePosition) > this.user.positionLimit) await this.cancel(Order.VIOLATES_POSITION_LIMITS);
        return this.status;
    }
};
