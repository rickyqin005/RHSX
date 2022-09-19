module.exports = class Market {
    static ERROR = {
        MARKET_CLOSED: new Error('Market is closed'),
        MARKET_ALREADY_OPEN: new Error('Market is already open'),
        MARKET_ALREADY_CLOSED: new Error('Market is already closed')
    };
    static collection = global.mongoClient.db('RHSX').collection('Market');

    isOpen;

    async initialize() {
        const args = await Market.collection.findOne();
        this.isOpen = args.isOpen;
        return this;
    }

    async open(mongoSession) {
        if(this.isOpen) throw Market.ERROR.MARKET_ALREADY_OPEN;
        await Market.collection.updateOne({}, { $set: { isOpen: true } }, { session: mongoSession });
        this.isOpen = true;
    }

    async close(mongoSession) {
        if(!this.isOpen) throw Market.ERROR.MARKET_ALREADY_CLOSED;
        await Market.collection.updateOne({}, { $set: { isOpen: false } }, { session: mongoSession });
        this.isOpen = false;
    }
};
