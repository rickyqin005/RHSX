module.exports = {
    ephemeral: false,
    execute: async function (interaction, mongoSession) {
        await global.market.close(mongoSession);
        return { content: 'Market is now closed' };
    }
};
