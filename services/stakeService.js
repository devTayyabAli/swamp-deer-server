const Sale = require('../models/Sale');
const User = require('../models/User');
// Deleted redundant Stake model import
const UserStakeReward = require('../models/UserStakingReward');
const Rank = require('../models/Rank');
const {
    getPhaseConfig,
    getAllPhases,
    INVESTMENT_CONSTANTS,
    PRODUCT_STATUS
} = require('../config/investmentPlans');

// Instant Referral Bonus (Direct/Indirect) - On Investment Amount
const INSTANT_BONUS_RATES = [0.06, 0.025, 0.02, 0.015, 0.015, 0.01, 0.01, 0.005]; // Level 1-8

// Matching Bonus (Profit Share) - On Investor's Monthly Profit
const MATCHING_BONUS_RATES = [0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01]; // Level 1-8

// Rank Targets (Cash for Without Product / Products for With Product)
const RANK_TARGETS = [
    { rankId: 1, title: 'Sales Executive', withoutProduct: 1500000, withProduct: 3000000 },
    { rankId: 2, title: 'Sales Officer', withoutProduct: 4500000, withProduct: 9000000 },
    { rankId: 3, title: 'Sales Manager', withoutProduct: 13500000, withProduct: 27000000 },
    { rankId: 4, title: 'Regional Sales Manager', withoutProduct: 40500000, withProduct: 81000000 },
    { rankId: 5, title: 'Regional Director', withoutProduct: 121500000, withProduct: 243000000 },
    { rankId: 6, title: 'Zonal Head', withoutProduct: 364500000, withProduct: 729000000 },
    { rankId: 7, title: 'Director', withoutProduct: 1093500000, withProduct: 2187000000 },
    { rankId: 8, title: 'Ambassador', withoutProduct: 3280500000, withProduct: 6561000000 }
];

/**
 * Main function to process a completed sale
 */
const processCompletedSale = async (saleId) => {
    try {
        const sale = await Sale.findById(saleId).populate('user investorId');
        if (!sale || sale.status !== 'completed') return;

        console.log(`Processing completed sale: ${saleId}`);

        // 1. Activate Investment (formerly Stake) for Investor by updating the sale record
        await activateStake(sale);

        // 2. Distribute Instant Referral Bonuses up to 8 levels
        await distributeInstantBonuses(sale);

        // 3. Update Business Volumes
        await updateBusinessVolumes(sale);

        // 4. Check Rank Upgrades for the Sales Rep and their upline
        await checkRankUpgrades(sale.user._id, sale.productStatus);

    } catch (error) {
        console.error('Error in processCompletedSale:', error);
    }
};

/**
 * Updates the Sale record to become an active investment (formerly activateStake)
 */
const activateStake = async (sale) => {
    // Determine product status from sale or default
    const productStatus = sale.productStatus === 'with_product'
        ? PRODUCT_STATUS.WITH_PRODUCT
        : PRODUCT_STATUS.WITHOUT_PRODUCT;

    // Get initial phase config
    const initialPhase = getPhaseConfig(productStatus, 1);

    // Set duration to 12 months (365 days)
    const duration = INVESTMENT_CONSTANTS.TOTAL_DURATION_DAYS;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Calculate profit cap (5x investment)
    const profitCap = sale.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER;

    // Update the sale record with investment tracking info
    // We use 'active' status for investments that are currently earning rewards
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

    console.log(`Investment activated for sale ${sale._id} (User: ${sale.investorId._id}) with plan: ${productStatus}, cap: ${profitCap}`);
};

/**
 * Distributes instant referral bonuses to the upline chain
 */
const distributeInstantBonuses = async (sale) => {
    // If there's a specific referrerId, start from there, otherwise start from the sales rep's upline
    if (!sale || !sale.investorId) return;
    const investorId = sale.investorId._id || sale.investorId;
    const investor = await User.findById(investorId);
    if (!investor || !investor.upline) return;

    let currentUplineId = investor.upline;

    for (let level = 1; level <= 8; level++) {
        if (!currentUplineId) break;

        const rate = INSTANT_BONUS_RATES[level - 1];
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
            console.log(`Level ${level} bonus of ${commissionAmount} distributed to ${uplineUser.userName}`);
        }

        currentUplineId = uplineUser.upline;
    }
};

/**
 * Distributes matching bonuses (commission on investor's ROI)
 */
const distributeMatchingBonuses = async (rewardRecord) => {
    // This is called whenever an investor receives their monthly ROI
    // stakeId now refers to a Sale record
    if (!rewardRecord || !rewardRecord.stakeId) return;
    const sale = await Sale.findById(rewardRecord.stakeId);
    if (!sale) return;

    const investor = await User.findById(sale.investorId);
    if (!investor || !investor.upline) return;

    let currentUplineId = investor.upline;

    for (let level = 1; level <= 8; level++) {
        if (!currentUplineId) break;

        const rate = MATCHING_BONUS_RATES[level - 1];
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
            console.log(`Level ${level} matching bonus of ${matchingAmount} distributed to ${uplineUser.userName}`);
        }

        currentUplineId = uplineUser.upline;
    }
};

/**
 * Updates self, direct, and team business volumes
 */
const updateBusinessVolumes = async (sale) => {
    // Update Sales Rep's Self Business
    await User.findByIdAndUpdate(sale.user._id, {
        $inc: { totalSelfBusiness: sale.amount }
    });

    // Update Uplines' Team Business
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
const checkRankUpgrades = async (userId, productStatus = 'without_product') => {
    let currentUserId = userId;

    while (currentUserId) {
        const user = await User.findById(currentUserId);
        if (!user) break;

        const currentRankId = user.userRankId || 0;
        let nextRank = null;

        // Find the highest rank they qualify for
        for (const target of RANK_TARGETS) {
            if (target.rankId > currentRankId) {
                // Determine which target to use based on the sale TYPE that triggered the check
                const targetValue = productStatus === 'with_product' ? target.withProduct : target.withoutProduct;

                if (user.totalTeamBusiness >= targetValue) {
                    nextRank = target;
                } else {
                    break; // Doesn't qualify for this or higher
                }
            }
        }

        if (nextRank) {
            user.userRankId = nextRank.rankId;
            await user.save();
            console.log(`User ${user.userName} upgraded to rank: ${nextRank.title}`);
        }

        currentUserId = user.upline;
    }
};

/**
 * Calculates current profit rate based on phase for a sale record
 */
const calculateCurrentPhaseRate = (sale) => {
    const config = getPhaseConfig(sale.productStatus, sale.currentPhase);
    return config ? config.rate : 0;
};

/**
 * Checks if investment should transition to next phase
 * @returns {boolean} true if transitioned
 */
const checkPhaseTransition = async (sale, monthsCompletedInCurrentPhase) => {
    const config = getPhaseConfig(sale.productStatus, sale.currentPhase);

    // Check if current phase duration is completed
    if (monthsCompletedInCurrentPhase >= config.months) {
        const nextPhase = sale.currentPhase + 1;

        // Check if next phase exists
        const nextConfig = getPhaseConfig(sale.productStatus, nextPhase);

        if (nextConfig) {
            sale.currentPhase = nextPhase;
            sale.phaseStartDate = new Date();
            // Update rewardPercentage for reference
            sale.rewardPercentage = nextConfig.rate;
            await sale.save();
            console.log(`Sale/Investment ${sale._id} transitioned to Phase ${nextPhase}`);
            return true;
        }
    }

    return false;
};

/**
 * Checks if adding reward would exceed profit cap for a sale record
 * @returns {number} Allowed reward amount
 */
const checkProfitCap = async (sale, proposedReward) => {
    const currentTotal = sale.totalProfitEarned || 0;
    const projectedTotal = currentTotal + proposedReward;
    const profitCap = sale.profitCap || (sale.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER);

    if (projectedTotal >= profitCap) {
        // Cap reached or exceeded
        const remainingAllowed = Math.max(0, profitCap - currentTotal);

        if (remainingAllowed < proposedReward) {
            console.log(`PROFIT CAP REACHED for Sale/Investment ${sale._id}. Cap: ${profitCap}, Earned: ${currentTotal}, Proposed: ${proposedReward}, Allowed: ${remainingAllowed}`);
        }

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
