module.exports = {
    setW: function (value, length) {
        value = String(value);
        return value + ' '.repeat(Math.max(length - value.length, 0));
    },
    toTitleCase: function (str) {
        return str.replace(
            /\w\S*/g,
            function(txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
        );
    },
    dateStr: function (date) {
        return date.toLocaleString('en-US', { timeZone: 'America/Toronto' });
    },
    toPercent: function (num, options) {
        options = {
            decimalPlaces: options.decimalPlaces ?? 2,
            leadingSign: options.leadingSign ?? false
        }
        const percentNum = num*100;
        return `${(percentNum >= 0 && options.leadingSign) ? '+' : ''}${percentNum.toFixed(options.decimalPlaces)}%`;
    }
};
