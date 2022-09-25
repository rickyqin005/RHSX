const Order = require('./Order');
const Position = require('../Position');
const { SlashCommandIntegerOption } = require('@discordjs/builders');

module.exports = class NormalOrder extends Order {
    static MIN_QUANTITY = 1;
    static MAX_QUANTITY = 1000000;
    static OPTION = {
        QUANTITY: function () {
            return new SlashCommandIntegerOption()
                .setName('quantity')
                .setDescription('quantity')
                .setMinValue(NormalOrder.MIN_QUANTITY)
                .setMaxValue(NormalOrder.MAX_QUANTITY);
        }
    };

    constructor(args) {
        super(args);
        this.quantity = args.quantity;
        this.quantityFilled = args.quantityFilled ?? 0;
    }

    toStopString() {}

    getQuantityUnfilled() {
        return this.quantity - this.quantityFilled;
    }

    netPositionChangeSign() {
        return ((this.direction == Order.BUY) ? 1 : -1);
    }

    async increaseQuantityFilled(amount, price, mongoSession) {
        this.quantityFilled += amount;
        await Order.collection.updateOne({ _id: this._id }, { $inc: { quantityFilled: amount } }, { session: mongoSession });

        if(this.quantityFilled == 0) await this.setStatus(Order.NOT_FILLED, mongoSession);
        else if(this.quantityFilled < this.quantity) await this.setStatus(Order.PARTIALLY_FILLED, mongoSession);
        else if(this.quantityFilled == this.quantity) await this.setStatus(Order.COMPLETELY_FILLED, mongoSession);
        await this.user.addPosition(new Position({
            ticker: this.ticker._id,
            quantity: amount*this.netPositionChangeSign(),
            costBasis: amount*this.netPositionChangeSign()*price
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

    async violatesPositionLimits(mongoSession) {
        const LimitOrder = require('./LimitOrder');
        const currPosition = this.user.positions[this.ticker._id];
        const positionLimit = (this.direction == Order.BUY ? this.user.maxPositionLimit : this.user.minPositionLimit);
        let extremePosition = (currPosition == undefined ? 0 : currPosition.quantity) + this.getQuantityUnfilled()*this.netPositionChangeSign();
        if(Math.abs(extremePosition) > Math.abs(positionLimit)) return true;
        const pendingOrders = await Order.queryOrders({
            type: LimitOrder.TYPE,
            user: this.user._id,
            direction: this.direction,
            ticker: this.ticker._id,
            status: { $in: [Order.NOT_FILLED, Order.PARTIALLY_FILLED] }
        }, {});
        for(const order of pendingOrders) {
            extremePosition += order.getQuantityUnfilled()*order.netPositionChangeSign();
            if(Math.abs(extremePosition) > Math.abs(positionLimit)) return true;
        }
        return false;
    }
};
