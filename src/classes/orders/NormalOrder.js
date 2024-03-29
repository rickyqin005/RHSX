const Order = require('./Order');
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

    increaseQuantityFilled(amount, price) {
        const Position = require('../Position');
        this.quantityFilled += amount;
        Order.changedDocuments.add(this);
        if(this.quantityFilled == 0) this.setStatus(Order.NOT_FILLED);
        else if(this.quantityFilled < this.quantity) this.setStatus(Order.PARTIALLY_FILLED);
        else if(this.quantityFilled == this.quantity) this.setStatus(Order.COMPLETELY_FILLED);
        this.user.addPosition(new Position({
            ticker: this.ticker._id,
            quantity: amount*this.netPositionChangeSign(),
            costBasis: amount*this.netPositionChangeSign()*price
        }).deserialize());
    }

    match(existingOrder) {
        const quantity = Math.min(this.getQuantityUnfilled(), existingOrder.getQuantityUnfilled());
        const price = existingOrder.price;
        existingOrder.increaseQuantityFilled(quantity, price);
        this.increaseQuantityFilled(quantity, price);
        existingOrder.ticker.increaseVolume(quantity);
        return { quantity: quantity, price: price };
    }

    async violatesPositionLimits() {
        const LimitOrder = require('./LimitOrder');
        const currPosition = this.user.positions.get(this.ticker);
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

    async fill() {}

    async process() {
        if(!(await super.process())) return false;
        await this.fill();
        return true;
    }
};
