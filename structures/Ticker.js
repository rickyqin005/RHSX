module.exports = class Ticker {
    static collection = global.mongoClient.db('RHSX').collection('Tickers');

    static async getTicker(_id) {
        let res = await this.collection.findOne({ _id: _id }, global.current.mongoSession);
        if(res != null) res = new Ticker(res);
        return res;
    }
    static async queryTickers(query, sort) {
        let res = await this.collection.find(query, global.current.mongoSession).sort(sort).toArray();
        for(let i = 0; i < res.length; i++) res[i] = new Ticker(res[i]);
        return res;
    }

    constructor(args) {
        this._id = args._id;
        this.lastTradedPrice = args.lastTradedPrice;
        this.volume = args.volume;
    }
};