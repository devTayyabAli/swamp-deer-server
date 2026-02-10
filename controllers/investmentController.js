const Sale = require('../models/Sale');
const User = require('../models/User');
const ResponseHelper = require('../utils/ResponseHelper');
const {
    getInvestmentPlanDetails,
    PRODUCT_STATUS,
    INVESTMENT_CONSTANTS,
    getPhaseConfig
} = require('../config/investmentPlans');
const { calculateCurrentPhaseRate } = require('../services/stakeService');

// @desc    Get available investment plans
// @route   GET /api/investments/plans
// @access  Public
const getInvestmentPlans = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const withProductPlan = getInvestmentPlanDetails(PRODUCT_STATUS.WITH_PRODUCT);
        const withoutProductPlan = getInvestmentPlanDetails(PRODUCT_STATUS.WITHOUT_PRODUCT);

        response.success = true;
        response.message = "Investment plans retrieved successfully";
        response.status = 200;
        response.data = {
            plans: [withProductPlan, withoutProductPlan],
            capMultiplier: INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER,
            duration: INVESTMENT_CONSTANTS.TOTAL_DURATION_MONTHS
        };
    } catch (error) {
        console.error('Get Investment Plans Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

// @desc    Get user's active stakes
// @route   GET /api/investments/my-stakes
// @access  Private
const getUserStakes = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const investments = await Sale.find({
            investorId: req.user._id,
            status: { $in: ['active', 'completed'] }
        }).sort({ createdAt: -1 });

        // Enrich investments with current phase details
        const enrichedInvestments = investments.map(investment => {
            const investmentObj = investment.toObject();

            // Calculate current progress
            const profitCap = investment.profitCap || (investment.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER);
            const profitProgress = Math.min(100, (investment.totalProfitEarned / profitCap) * 100);
            const timeProgress = Math.min(100, (investment.monthsCompleted / INVESTMENT_CONSTANTS.TOTAL_DURATION_MONTHS) * 100);

            // Get current phase details
            const currentPhaseConfig = investment.productStatus
                ? getPhaseConfig(investment.productStatus, investment.currentPhase)
                : null;

            return {
                ...investmentObj,
                profitCap,
                profitProgress: parseFloat(profitProgress.toFixed(1)),
                timeProgress: parseFloat(timeProgress.toFixed(1)),
                currentMonthlyRate: currentPhaseConfig ? currentPhaseConfig.rate : investment.rewardPercentage,
                currentMonthlyRatePercentage: currentPhaseConfig
                    ? `${(currentPhaseConfig.rate * 100).toFixed(1)}%`
                    : `${(investment.rewardPercentage * 100).toFixed(1)}%`,
                remainingProfit: Math.max(0, profitCap - (investment.totalProfitEarned || 0)),
                isCapReached: (investment.totalProfitEarned || 0) >= profitCap
            };
        });

        response.success = true;
        response.message = "User stakes retrieved successfully";
        response.status = 200;
        response.data = enrichedInvestments;
    } catch (error) {
        console.error('Get User Stakes Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

// @desc    Get details of a specific stake
// @route   GET /api/investments/:id
// @access  Private
const getStakeDetails = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const investment = await Sale.findOne({
            _id: req.params.id,
            investorId: req.user._id
        });

        if (!investment) {
            response.message = "Investment not found";
            response.status = 404;
            return res.status(response.status).json(response);
        }

        const investmentObj = investment.toObject();

        const profitCap = investment.profitCap || (investment.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER);
        const totalProfitEarned = investment.totalProfitEarned || 0;
        const currentRate = calculateCurrentPhaseRate(investment) || investment.rewardPercentage;

        // Projection
        const nextPhaseConfig = investment.productStatus
            ? getPhaseConfig(investment.productStatus, investment.currentPhase + 1)
            : null;

        response.success = true;
        response.message = "Investment details retrieved successfully";
        response.status = 200;
        response.data = {
            ...investmentObj,
            metrics: {
                profitCap,
                totalProfitEarned,
                remainingProfitPotential: Math.max(0, profitCap - totalProfitEarned),
                profitProgressPercent: parseFloat(((totalProfitEarned / profitCap) * 100).toFixed(1)),
                timeProgressPercent: parseFloat(((investment.monthsCompleted || 0) / INVESTMENT_CONSTANTS.TOTAL_DURATION_MONTHS * 100).toFixed(1)),
                currentPhaseRate: currentRate,
                currentPhaseRatePercent: `${(currentRate * 100).toFixed(1)}%`
            },
            nextPhase: nextPhaseConfig ? {
                phase: nextPhaseConfig.phase,
                rate: nextPhaseConfig.rate,
                ratePercent: `${(nextPhaseConfig.rate * 100).toFixed(1)}%`,
                description: nextPhaseConfig.description
            } : null,
            planDetails: investment.productStatus ? getInvestmentPlanDetails(investment.productStatus) : null
        };

    } catch (error) {
        console.error('Get Stake Details Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

module.exports = {
    getInvestmentPlans,
    getUserStakes,
    getStakeDetails
};
