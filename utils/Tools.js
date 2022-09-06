module.exports = {
    setW: function (value, length) {
        value = String(value);
        return value + ' '.repeat(Math.max(length - value.length, 0));
    },
    dateStr: function (date) {
        return date.toLocaleString('en-US', { timeZone: 'America/Toronto' });
    }
};
