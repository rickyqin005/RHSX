module.exports = class Price {
    static toPrice(price) {
        return Math.round(price*100);
    }
    static format(price) {
        if(price == null || price == undefined) return '-';
        price = price/100;
        if(Number.isNaN(price)) return '-';
        return Price.round(price).toFixed(2);
    }
    static round(price) {
        return Math.round((price+Number.EPSILON)*100)/100;
    }
};