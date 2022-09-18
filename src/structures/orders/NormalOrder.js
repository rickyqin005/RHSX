const Order = require('./Order');
const Position = require('../Position');

module.exports = class NormalOrder extends Order {
    static MIN_QUANTITY = 1;
    static MAX_QUANTITY = 1000000;

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

    async increaseQuantityFilled(amount, price, mongoSession) {
        this.quantityFilled += amount;
        await Order.collection.updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } }, { session: mongoSession });

        if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED, mongoSession);
        else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED, mongoSession);
        else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED, mongoSession);
        await this.user.addPosition(new Position({
            ticker: this.ticker._id,
            quantity: amount*this.netPositionChangeSign,
            costBasis: amount*this.netPositionChangeSign*price
        }), mongoSession);
    }

    async match(existingOrder, mongoSession) {
        const Ticker = require('../Ticker');
        const quantity = Math.min(this.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        const price = existingOrder.price;
        await existingOrder.increaseQuantityFilled(quantity, price, mongoSession);
        await this.increaseQuantityFilled(quantity, price, mongoSession);
        await existingOrder.ticker.increaseVolume(quantity, mongoSession);
        return { quantity: quantity, price: price };
    }

    async checkPositionLimits(mongoSession) {
        const currPosition = this.user.positions[this.ticker._id];
        let extremePosition = (currPosition == undefined ? 0 : currPosition.quantity) + this.getQuantityUnfilled()*this.netPositionChangeSign;
        (await this.user.getPendingOrders()).forEach(pendingOrder => {
            if(pendingOrder instanceof NormalOrder) {
                if(this.netPositionChangeSign == pendingOrder.netPositionChangeSign) extremePosition += pendingOrder.getQuantityUnfilled()*pendingOrder.netPositionChangeSign;
            }
        });
        if(Math.abs(extremePosition) > this.user.positionLimit) await this.cancel(Order.VIOLATES_POSITION_LIMITS, mongoSession);
        return this.status;
    }
};
