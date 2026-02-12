const Sale = require('../models/Sale');
const User = require('../models/User');
const UserStakeReward = require('../models/UserStakingReward');
const Rank = require('../models/Rank');
const {
    getPhaseConfig,
    getAllPhases,
    INVESTMENT_CONSTANTS,
    PRODUCT_STATUS,
    getActiveConfiguration
} = require('../config/investmentPlans');

/**
 * Main function to process a completed sale
 */
const processCompletedSale = async (saleId) => {
    try {
        const sale = await Sale.findById(saleId).populate('user investorId');
        if (!sale || sale.status !== 'completed') return;

        console.log(`Processing completed sale: ${saleId}`);

        // Fetch active configuration for this context
        const config = await getActiveConfiguration(sale.user._id, sale.branchId);

        // 1. Activate Investment
        await activateStake(sale, config);

        // 2. Distribute Instant Referral Bonuses
        await distributeInstantBonuses(sale, config);

        // 3. Update Business Volumes
        await updateBusinessVolumes(sale);

        // 4. Check Rank Upgrades
        await checkRankUpgrades(sale.user._id, sale.productStatus, config);

    } catch (error) {
        console.error('Error in processCompletedSale:', error);
    }
};

/**
 * Updates the Sale record to become an active investment
 */
const activateStake = async (sale, config) => {
    const productStatus = sale.productStatus === 'with_product'
        ? PRODUCT_STATUS.WITH_PRODUCT
        : PRODUCT_STATUS.WITHOUT_PRODUCT;

    // Get initial phase config using dynamic settings
    const initialPhase = getPhaseConfig(productStatus, 1, config);

    const duration = INVESTMENT_CONSTANTS.TOTAL_DURATION_DAYS;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Dynamic profit cap multiplier
    const profitCap = sale.amount * (config.profitCapMultiplier || INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER);

    sale.status = 'active';
    sale.duration = duration;
    sale.rewardPercentage = initialPhase.rate;
    sale.endDate = endDate;
    sale.currentPhase = 1;
    sale.phaseStartDate = new Date();
    sale.monthsCompleted = 0;
    sale.totalProfitEarned = 0;
    sale.profitCap = profitCap;

    await sale.save();

    console.log(`Investment activated for sale ${sale._id} with plan: ${productStatus}, cap: ${profitCap}`);
};

/**
 * Distributes instant referral bonuses
 */
const distributeInstantBonuses = async (sale, config) => {
    if (!sale || !sale.investorId) return;
    const investor = await User.findById(sale.investorId);
    if (!investor || !investor.upline) return;

    let currentUplineId = investor.upline;
    const rates = config.referralBonusRates;

    for (let level = 1; level <= 8; level++) {
        if (!currentUplineId) break;

        const rate = rates[level - 1] || 0;
        const commissionAmount = sale.amount * rate;

        const uplineUser = await User.findById(currentUplineId);
        if (!uplineUser) break;

        if (commissionAmount > 0) {
            await UserStakeReward.create({
                userId: currentUplineId,
                stakeId: sale._id,
                amount: commissionAmount,
                type: 'direct_income',
                description: `Level ${level} referral bonus from ${sale.customerName}'s investment`
            });
        }

        currentUplineId = uplineUser.upline;
    }
};

/**
 * Distributes matching bonuses
 */
const distributeMatchingBonuses = async (rewardRecord) => {
    if (!rewardRecord || !rewardRecord.stakeId) return;
    const sale = await Sale.findById(rewardRecord.stakeId);
    if (!sale) return;

    // Fetch config for the context that generated the reward
    const config = await getActiveConfiguration(sale.user, sale.branchId);

    const investor = await User.findById(sale.investorId);
    if (!investor || !investor.upline) return;

    let currentUplineId = investor.upline;
    const rates = config.matchingBonusRates;

    for (let level = 1; level <= 8; level++) {
        if (!currentUplineId) break;

        const rate = rates[level - 1] || 0;
        const matchingAmount = rewardRecord.amount * rate;

        const uplineUser = await User.findById(currentUplineId);
        if (!uplineUser) break;

        if (matchingAmount > 0) {
            await UserStakeReward.create({
                userId: currentUplineId,
                stakeId: sale._id,
                amount: matchingAmount,
                type: 'level_income',
                description: `Level ${level} matching bonus from ${sale.customerName}'s monthly profit`
            });
        }

        currentUplineId = uplineUser.upline;
    }
};

/**
 * Updates self, direct, and team business volumes
 */
const updateBusinessVolumes = async (sale) => {
    await User.findByIdAndUpdate(sale.user._id, {
        $inc: { totalSelfBusiness: sale.amount }
    });

    let currentUplineId = sale.user.upline;
    let isFirstUpline = true;

    while (currentUplineId) {
        const update = { $inc: { totalTeamBusiness: sale.amount } };
        if (isFirstUpline) {
            update.$inc.totalDirectBusiness = sale.amount;
            isFirstUpline = false;
        }

        const upline = await User.findByIdAndUpdate(currentUplineId, update);
        if (!upline) break;
        currentUplineId = upline.upline;
    }
};

/**
 * Checks if a user or their uplines qualify for a rank upgrade
 */
const checkRankUpgrades = async (userId, productStatus = 'without_product', config) => {
    let currentUserId = userId;
    const rankTargets = config.rankTargets;

    while (currentUserId) {
        const user = await User.findById(currentUserId);
        if (!user) break;

        const currentRankId = user.userRankId || 0;
        let nextRank = null;

        for (const target of rankTargets) {
            if (target.rankId > currentRankId) {
                const targetValue = productStatus === 'with_product' ? target.withProduct : target.withoutProduct;

                if (user.totalTeamBusiness >= targetValue) {
                    nextRank = target;
                } else {
                    break;
                }
            }
        }

        if (nextRank) {
            user.userRankId = nextRank.rankId;
            await user.save();
        }

        currentUserId = user.upline;
    }
};

/**
 * Calculates current profit rate based on phase
 */
const calculateCurrentPhaseRate = async (sale) => {
    const config = await getActiveConfiguration(sale.user, sale.branchId);
    const phaseConfig = getPhaseConfig(sale.productStatus, sale.currentPhase, config);
    return phaseConfig ? phaseConfig.rate : 0;
};

/**
 * Checks if investment should transition to next phase
 */
const checkPhaseTransition = async (sale, monthsCompletedInCurrentPhase) => {
    const config = await getActiveConfiguration(sale.user, sale.branchId);
    const phaseConfig = getPhaseConfig(sale.productStatus, sale.currentPhase, config);

    if (monthsCompletedInCurrentPhase >= phaseConfig.months) {
        const nextPhase = sale.currentPhase + 1;
        const nextConfig = getPhaseConfig(sale.productStatus, nextPhase, config);

        if (nextConfig) {
            sale.currentPhase = nextPhase;
            sale.phaseStartDate = new Date();
            sale.rewardPercentage = nextConfig.rate;
            await sale.save();
            return true;
        }
    }

    return false;
};

/**
 * Checks if adding reward would exceed profit cap
 */
const checkProfitCap = async (sale, proposedReward) => {
    const config = await getActiveConfiguration(sale.user, sale.branchId);
    const currentTotal = sale.totalProfitEarned || 0;
    const projectedTotal = currentTotal + proposedReward;
    const profitCap = sale.profitCap || (sale.amount * config.profitCapMultiplier);

    if (projectedTotal >= profitCap) {
        const remainingAllowed = Math.max(0, profitCap - currentTotal);
        return {
            allowedAmount: remainingAllowed,
            isCapReached: true
        };
    }

    return {
        allowedAmount: proposedReward,
        isCapReached: false
    };
};

module.exports = {
    processCompletedSale,
    distributeInstantBonuses,
    distributeMatchingBonuses,
    calculateCurrentPhaseRate,
    checkPhaseTransition,
    checkProfitCap
};
