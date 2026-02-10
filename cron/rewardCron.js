const cron = require('node-cron');
const Sale = require('../models/Sale');
const User = require('../models/User');
const UserStakeReward = require('../models/UserStakingReward');
const CronLog = require('../models/CronLog');
const {
    distributeMatchingBonuses,
    calculateCurrentPhaseRate,
    checkPhaseTransition,
    checkProfitCap
} = require('../services/stakeService');
const { INVESTMENT_CONSTANTS } = require('../config/investmentPlans');

/**
 * Profit Share Distribution Cron
 * Handles individualized reward cycles for each investment.
 */
const distributeMonthlyRewards = async () => {
    const jobName = 'Profit Share Distribution';
    let attempts = 0;
    const maxAttempts = 3;
    console.log('Running Profit Share Distribution Cron...');
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Running ${jobName} Attempt ${attempts}/${maxAttempts} [${process.env.NODE_ENV}]...`);

        try {
            const activeInvestments = await Sale.find({ status: 'active' }).populate('investorId');
            const now = new Date();

            // Maturity Interval: 30 days for Prod, 10 mins for Dev
            const MATURITY_MS = process.env.NODE_ENV === 'development'
                ? 10 * 60 * 1000
                : 30 * 24 * 60 * 60 * 1000;

            let processedCount = 0;

            for (const investment of activeInvestments) {
                const user = investment.investorId;
                if (!user || user.status !== 'active') continue;

                // Check if this specific investment is due for a reward
                const referenceDate = investment.lastRewardAt || investment.createdAt;
                const msSinceLastReward = now - new Date(referenceDate);

                if (msSinceLastReward < MATURITY_MS) continue;

                // 1. Determine Current Phase Rate
                let rate = investment.rewardPercentage;
                if (investment.currentPhase) {
                    rate = calculateCurrentPhaseRate(investment);
                }

                // 2. Calculate Reward Amount
                const rawRewardAmount = investment.amount * rate;

                // 3. Check Profit Cap (5x Limit)
                const capCheck = await checkProfitCap(investment, rawRewardAmount);
                const rewardAmount = capCheck.allowedAmount;

                if (rewardAmount > 0) {
                    const rewardRecord = await UserStakeReward.create({
                        userId: user._id,
                        stakeId: investment._id,
                        amount: rewardAmount,
                        type: 'staking',
                        description: `Monthly Profit Share - Phase ${investment.currentPhase || 'N/A'}`
                    });

                    // Trigger matching bonus for uplines
                    await distributeMatchingBonuses(rewardRecord);

                    // Update Stake Stats
                    investment.lastRewardAt = new Date();
                    investment.totalProfitEarned = (investment.totalProfitEarned || 0) + rewardAmount;
                    investment.monthsCompleted = (investment.monthsCompleted || 0) + 1;

                    const productStatus = investment.productStatus || 'without_product';
                    const currentPhase = investment.currentPhase || 1;

                    const { getMonthsBeforePhase } = require('../config/investmentPlans');
                    const monthsBefore = getMonthsBeforePhase(productStatus, currentPhase);
                    const monthsInCurrent = investment.monthsCompleted - monthsBefore;

                    await checkPhaseTransition(investment, monthsInCurrent);

                    // Check for Completion (Cap or Time)
                    if (capCheck.isCapReached) {
                        investment.status = 'completed';
                        console.log(`Investment ${investment._id} COMPLETED (Cap Reached)`);
                    } else if (investment.monthsCompleted >= INVESTMENT_CONSTANTS.TOTAL_DURATION_MONTHS) {
                        investment.status = 'completed';
                        console.log(`Investment ${investment._id} COMPLETED (Time Expired)`);
                    }

                    await investment.save();
                    processedCount++;
                } else if (capCheck.isCapReached) {
                    investment.status = 'completed';
                    await investment.save();
                    processedCount++;
                }
            }

            // Log Successsss
            await CronLog.create({
                jobName,
                status: 'success',
                details: `Processed ${processedCount} due investments out of ${activeInvestments.length} active. (Attempt ${attempts})`
            });

            console.log(`Processed ${processedCount} due investments out of ${activeInvestments.length} active.`);
            break; // Success! Exit the retry loop

        } catch (error) {
            console.error(`Error in ${jobName} (Attempt ${attempts}):`, error);

            if (attempts === maxAttempts) {
                // Log Final Failure after all retries
                try {
                    await CronLog.create({
                        jobName,
                        status: 'failed',
                        error: error.message,
                        details: `Failed after ${maxAttempts} attempts. Final error: ${error.message}`
                    });
                } catch (logError) {
                    console.error('Failed to save cron log:', logError);
                }
            } else {
                // Wait 5 seconds before next attempt
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    }
};

// Schedule: 
// Development: every 10 minutes
// Production: every hour (checking for matured individual investments)
const cronSchedule = process.env.NODE_ENV === 'development' ? '*/5 * * * *' : '0 * * * *';
cron.schedule(cronSchedule, distributeMonthlyRewards);

module.exports = {
    distributeMonthlyRewards
};
