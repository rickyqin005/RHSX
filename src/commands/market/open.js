module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        await global.market.open(mongoSession);
        return { content: 'Market is now open' };
    }
};
