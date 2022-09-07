module.exports = {
    Order: {
        BUY: 'BUY',
        SELL: 'SELL',
        CANCELLED: -1,
        UNSUBMITTED: 0,
        IN_QUEUE: 1,
        NOT_FILLED: 2,
        PARTIALLY_FILLED: 3,
        COMPLETELY_FILLED: 4,
        UNFULFILLABLE: 0,
        VIOLATES_POSITION_LIMITS: 1
    },
    LimitOrder: {
        TYPE: 'limit',
        LABEL: 'limit order'
    },
    MarketOrder: {
        TYPE: 'market',
        LABEL: 'market order'
    },
    StopOrder: {
        TYPE: 'stop',
        LABEL: 'stop order'
    }
};
