module.exports = class Market {
    static collection = global.mongoClient.db('RHSX').collection('Market');

    isOpen;

    async initialize() {
        const args = await Market.collection.findOne();
        this.isOpen = args.isOpen;
        return this;
    }

    async open() {
        if(this.isOpen) throw new Error('Market is already open');
        await Market.collection.updateOne({}, { $set: { isOpen: true } });
        this.isOpen = true;
    }

    async close() {
        if(!this.isOpen) throw new Error('Market is already closed');
        await Market.collection.updateOne({}, { $set: { isOpen: false } });
        this.isOpen = false;
    }
};
