module.exports = class Market {
    static ERROR = {
        MARKET_CLOSED: new Error('Market is closed')
    };
    static collection = global.mongoClient.db('RHSX').collection('Market');
    static changedDocuments = new Set();

    constructor(args) {
        this._id = args._id;
    }

    async resolve() {
        const args = await Market.collection.findOne({ _id: this._id });
        this.isOpen = args.isOpen;
        this.defaultStartingBalance = args.defaultStartingBalance;
        this.defaultCostPerOrderSubmitted = args.defaultCostPerOrderSubmitted;
        this.defaultCostPerShareTraded = args.defaultCostPerShareTraded;
        this.defaultMinPositionLimit = args.defaultMinPositionLimit;
        this.defaultMaxPositionLimit = args.defaultMaxPositionLimit;
        return this;
    }

    toDBObject() {
        const obj = new Market(this);
        return obj;
    }

    open() {
        if(this.isOpen) throw new Error('Market is already open');
        this.isOpen = true;
        Market.changedDocuments.add(this);
    }

    close() {
        if(!this.isOpen) throw new Error('Market is already closed');
        this.isOpen = false;
        Market.changedDocuments.add(this);
    }
};
