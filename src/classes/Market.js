module.exports = class Market {
    static ERROR = {
        MARKET_CLOSED: new Error('Market is closed')
    };
    static collection = global.mongoClient.db('RHSX').collection('Market');
    static changedDocuments = new Set();

    constructor(args) {
        this._id = args._id;
        this.isOpen = args.isOpen ?? undefined;
    }

    async resolve() {
        const args = await Market.collection.findOne({ _id: this._id });
        this.isOpen = args.isOpen;
        return this;
    }

    toDBObject() {
        const obj = new Market(this);
        return obj;
    }

    async open() {
        if(this.isOpen) throw new Error('Market is already open');
        this.isOpen = true;
        Market.changedDocuments.add(this);
    }

    async close() {
        if(!this.isOpen) throw new Error('Market is already closed');
        this.isOpen = false;
        Market.changedDocuments.add(this);
    }
};
