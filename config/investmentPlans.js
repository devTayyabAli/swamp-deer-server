/**
 * Investment Plan Configuration
 * Defines the two investment plans with phase-based profit structures
 */

// Investment Plan Types
const PRODUCT_STATUS = {
    WITH_PRODUCT: 'with_product',
    WITHOUT_PRODUCT: 'without_product'
};

// With Product Plan: 12 months, 3 phases of 4 months each
const WITH_PRODUCT_PHASES = [
    { phase: 1, months: 4, rate: 0.05, description: 'First 4 months at 5% monthly' },
    { phase: 2, months: 4, rate: 0.06, description: 'Second 4 months at 6% monthly' },
    { phase: 3, months: 4, rate: 0.07, description: 'Third 4 months at 7% monthly' }
];

// Without Product Plan: 12 months, 4 phases of 3 months each
const WITHOUT_PRODUCT_PHASES = [
    { phase: 1, months: 3, rate: 0.07, description: 'First 3 months at 7% monthly' },
    { phase: 2, months: 3, rate: 0.08, description: 'Second 3 months at 8% monthly' },
    { phase: 3, months: 3, rate: 0.09, description: 'Third 3 months at 9% monthly' },
    { phase: 4, months: 3, rate: 0.10, description: 'Fourth 3 months at 10% monthly' }
];

// Investment Constants
const INVESTMENT_CONSTANTS = {
    PROFIT_CAP_MULTIPLIER: 5, // 5× the investment amount
    TOTAL_DURATION_DAYS: 365, // 12 months
    TOTAL_DURATION_MONTHS: 12
};

/**
 * Get phase configuration for a specific product status and phase number
 * @param {string} productStatus - 'with_product' or 'without_product'
 * @param {number} phaseNumber - Phase number (1-3 for with_product, 1-4 for without_product)
 * @returns {object} Phase configuration
 */
const getPhaseConfig = (productStatus, phaseNumber) => {
    const phases = productStatus === PRODUCT_STATUS.WITH_PRODUCT
        ? WITH_PRODUCT_PHASES
        : WITHOUT_PRODUCT_PHASES;

    return phases.find(p => p.phase === phaseNumber);
};

/**
 * Get all phases for a product status
 * @param {string} productStatus - 'with_product' or 'without_product'
 * @returns {array} Array of phase configurations
 */
const getAllPhases = (productStatus) => {
    return productStatus === PRODUCT_STATUS.WITH_PRODUCT
        ? WITH_PRODUCT_PHASES
        : WITHOUT_PRODUCT_PHASES;
};

/**
 * Calculate total months completed before a specific phase
 * @param {string} productStatus - 'with_product' or 'without_product'
 * @param {number} phaseNumber - Phase number
 * @returns {number} Total months before this phase
 */
const getMonthsBeforePhase = (productStatus, phaseNumber) => {
    const phases = getAllPhases(productStatus);
    return phases
        .filter(p => p.phase < phaseNumber)
        .reduce((sum, p) => sum + p.months, 0);
};

/**
 * Calculate total expected profit for a plan
 * @param {string} productStatus - 'with_product' or 'without_product'
 * @param {number} investmentAmount - Initial investment amount
 * @returns {number} Total expected profit over 12 months
 */
const calculateTotalExpectedProfit = (productStatus, investmentAmount) => {
    const phases = getAllPhases(productStatus);
    let totalProfit = 0;

    for (const phase of phases) {
        totalProfit += investmentAmount * phase.rate * phase.months;
    }

    return totalProfit;
};

/**
 * Get investment plan details
 * @param {string} productStatus - 'with_product' or 'without_product'
 * @returns {object} Plan details
 */
const getInvestmentPlanDetails = (productStatus) => {
    const phases = getAllPhases(productStatus);
    const planName = productStatus === PRODUCT_STATUS.WITH_PRODUCT
        ? 'With Product Plan'
        : 'Without Product Plan';

    // Calculate total return percentage
    const totalReturnPercentage = phases.reduce((sum, p) => sum + (p.rate * p.months), 0);

    return {
        name: planName,
        productStatus,
        duration: {
            months: INVESTMENT_CONSTANTS.TOTAL_DURATION_MONTHS,
            days: INVESTMENT_CONSTANTS.TOTAL_DURATION_DAYS
        },
        profitCapMultiplier: INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER,
        totalPhases: phases.length,
        phases: phases.map(p => ({
            phase: p.phase,
            months: p.months,
            monthlyRate: p.rate,
            monthlyRatePercentage: `${(p.rate * 100).toFixed(1)}%`,
            totalPhaseReturn: p.rate * p.months,
            totalPhaseReturnPercentage: `${(p.rate * p.months * 100).toFixed(1)}%`,
            description: p.description
        })),
        totalReturnPercentage: `${(totalReturnPercentage * 100).toFixed(1)}%`,
        totalReturn: totalReturnPercentage
    };
};

module.exports = {
    PRODUCT_STATUS,
    WITH_PRODUCT_PHASES,
    WITHOUT_PRODUCT_PHASES,
    INVESTMENT_CONSTANTS,
    getPhaseConfig,
    getAllPhases,
    getMonthsBeforePhase,
    calculateTotalExpectedProfit,
    getInvestmentPlanDetails
};
