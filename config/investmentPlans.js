const InvestmentPlan = require('../models/InvestmentPlan');

// Default constants (for fallback)
const PRODUCT_STATUS = {
    WITH_PRODUCT: 'with_product',
    WITHOUT_PRODUCT: 'without_product'
};

const INVESTMENT_CONSTANTS = {
    TOTAL_DURATION_DAYS: 365,
    TOTAL_DURATION_MONTHS: 12
};

/**
 * Gets the active configuration hierarchy for a user
 * @param {string} userId - Specific user ID
 * @param {string} branchId - Branch ID
 * @returns {object} Combined configuration object
 */
const getActiveConfiguration = async (userId = null, branchId = null) => {
    // 1. Get Global Config
    let config = await InvestmentPlan.findOne({ scope: 'global' }).lean();

    // 2. Override with Branch Config
    if (branchId) {
        const branchConfig = await InvestmentPlan.findOne({ scope: 'branch', scopeId: branchId }).lean();
        if (branchConfig) config = { ...config, ...branchConfig };
    }

    // 3. Override with User (Team) Config
    if (userId) {
        const userConfig = await InvestmentPlan.findOne({ scope: 'user', scopeId: userId }).lean();
        if (userConfig) config = { ...config, ...userConfig };
    }

    // Default Fallbacks - REMOVED per user request
    if (!config) {
        throw new Error('Critical Error: Global Investment Plan not found in database. Please initialize the configuration.');
    }

    return config;
};

const getPhaseConfig = (productStatus, phaseNumber, config) => {
    const phases = productStatus === PRODUCT_STATUS.WITH_PRODUCT
        ? config.withProductPhases
        : config.withoutProductPhases;

    return phases.find(p => p.phase === phaseNumber);
};

const getAllPhases = (productStatus, config) => {
    return productStatus === PRODUCT_STATUS.WITH_PRODUCT
        ? config.withProductPhases
        : config.withoutProductPhases;
};

const getMonthsBeforePhase = (productStatus, phaseNumber, config) => {
    const phases = getAllPhases(productStatus, config);
    return phases
        .filter(p => p.phase < phaseNumber)
        .reduce((sum, p) => sum + p.months, 0);
};

module.exports = {
    PRODUCT_STATUS,
    INVESTMENT_CONSTANTS,
    getActiveConfiguration,
    getPhaseConfig,
    getAllPhases,
    getMonthsBeforePhase
};
