const Sale = require('../models/Sale');
const User = require('../models/User');
const UserStakeReward = require('../models/UserStakingReward');
const mongoose = require('mongoose');
const RankGiftRequest = require('../models/RankGiftRequest');
const { calculateBalance } = require('./withdrawalController');
const { getAllPhases, getActiveConfiguration } = require('../config/investmentPlans');

// @desc    Get dashboard statistics for current user
// @route   GET /api/investors/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get team members (direct and indirect)
        const directTeam = await User.find({ upline: userId });
        const directTeamIds = directTeam.map(member => member._id);

        // Recursive function to get all indirect team members
        const getIndirectTeam = async (userIds) => {
            const children = await User.find({ upline: { $in: userIds } });
            if (children.length === 0) return [];
            const childIds = children.map(c => c._id);
            const grandChildren = await getIndirectTeam(childIds);
            return [...children, ...grandChildren];
        };

        const indirectTeam = directTeamIds.length > 0 ? await getIndirectTeam(directTeamIds) : [];
        const indirectTeamIds = indirectTeam.map(member => member._id);

        // Get business volume from sales
        // Total business = sales made by user + direct team + indirect team
        const allTeamIds = [userId, ...directTeamIds, ...indirectTeamIds];

        const businessAggregation = await Sale.aggregate([
            {
                $match: {
                    user: { $in: allTeamIds },
                    status: { $in: ['completed', 'active'] }
                }
            },
            {
                $group: {
                    _id: {
                        user: '$user',
                        productStatus: '$productStatus'
                    },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Calculate business volumes
        let totalBusinessVolume = 0; // This will now represent "With Product" total
        let directBusinessVolume = 0; // This will now represent "Without Product" direct
        let totalDirectBusinessVolume = 0; // Sum of all "Without Product" in team
        let totalProductBusinessVolume = 0; // Sum of all "With Product" in team
        let indirectBusinessVolume = 0;

        businessAggregation.forEach(item => {
            const itemUserId = item._id.user.toString();
            const productStatus = item._id.productStatus;

            if (productStatus === 'without_product') {
                totalDirectBusinessVolume += item.totalAmount;
                // For "Direct Business" (Without Product) track: ONLY Direct Team (NOT user's own)
                if (directTeamIds.some(id => id.toString() === itemUserId)) {
                    directBusinessVolume += item.totalAmount;
                }
            } else {
                // For "With Product" sales
                totalProductBusinessVolume += item.totalAmount;

                // For "Total Team Business" - exclude user's own sales
                if (itemUserId !== userId.toString()) {
                    totalBusinessVolume += item.totalAmount;
                }

                // Track indirect business (exclude user AND direct team)
                if (itemUserId !== userId.toString() && !directTeamIds.some(id => id.toString() === itemUserId)) {
                    indirectBusinessVolume += item.totalAmount;
                }
            }
        });

        // Get total profit earned from rewards
        const rewardsAggregation = await UserStakeReward.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        let totalProfitEarned = 0;
        let investmentBonusKPI = 0; // Aggregated for Dashboard KPI
        let stakingRewards = 0; // Specific to 'staking' type for breakdown
        let levelIncome = 0;
        let referralIncome = 0;

        rewardsAggregation.forEach(reward => {
            totalProfitEarned += reward.total;

            // Track individual types for detailed breakdown
            if (reward._id === 'staking') stakingRewards = reward.total;
            if (reward._id === 'level_income') levelIncome = reward.total;
            if (reward._id === 'direct_income') referralIncome = reward.total;

            // Investment Bonus KPI includes all investment-related rewards
            if (reward._id === 'staking' || reward._id === 'direct_income' || reward._id === 'level_income') {
                investmentBonusKPI += reward.total;
            }
        });

        // Get monthly income (current calendar month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthlyRewardsAggregation = await UserStakeReward.aggregate([
            {
                $match: {
                    userId: userId,
                    createdAt: { $gte: monthStart, $lte: monthEnd }
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        let monthlyStakingIncome = 0;
        let monthlyLevelIncome = 0;
        let monthlyReferralIncome = 0;
        let monthlyTotalCommission = 0;

        monthlyRewardsAggregation.forEach(reward => {
            monthlyTotalCommission += reward.total;
            if (reward._id === 'staking') monthlyStakingIncome = reward.total;
            if (reward._id === 'level_income') monthlyLevelIncome = reward.total;
            if (reward._id === 'direct_income') monthlyReferralIncome = reward.total;
        });

        // Monthly direct business (without_product sales by direct team this month)
        const monthlyBusinessAggregation = await Sale.aggregate([
            {
                $match: {
                    user: { $in: directTeamIds },
                    productStatus: 'without_product',
                    status: { $in: ['completed', 'active'] },
                    createdAt: { $gte: monthStart, $lte: monthEnd }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const monthlyDirectBusiness = monthlyBusinessAggregation.length > 0 ? monthlyBusinessAggregation[0].total : 0;

        // Get investment overview (where user is the investor)
        const investmentAggregation = await Sale.aggregate([
            {
                $match: {
                    investorId: userId,
                    status: { $in: ['completed', 'active'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalInvestment: { $sum: '$amount' },
                    totalProfit: { $sum: '$totalProfitEarned' }
                }
            }
        ]);

        const investmentStats = investmentAggregation.length > 0 ? investmentAggregation[0] : {
            totalInvestment: 0,
            totalProfit: 0
        };

        // Calculate monthly profit dynamically from active and pending sales
        const activeSalesForROI = await Sale.find({
            investorId: new mongoose.Types.ObjectId(userId),
            status: { $in: ['completed', 'active'] }
        }).sort({ createdAt: -1 });

        console.log('activeSalesForROI', activeSalesForROI);

        console.log('=== MONTHLY PROFIT CALCULATION DEBUG ===');
        console.log('User ID:', userId);
        console.log('Number of pending/active sales found:', activeSalesForROI.length);
        console.log('Active/Pending Sales for Monthly Profit:', activeSalesForROI.map(s => ({
            id: s._id,
            amount: s.amount,
            investorProfit: s.investorProfit,
            status: s.status
        })));

        const monthlyProfit = activeSalesForROI.reduce((sum, s) => {
            const amount = Number(s.amount) || 0;
            const rate = Number(s.investorProfit) || 0.05; // Default to 5% if null, undefined, or 0
            const profit = amount * rate;
            console.log(`Sale ${s._id}: amount=${amount}, rate=${rate}, profit=${profit}`);
            return sum + profit;
        }, 0);

        console.log('FINAL Monthly Profit:', monthlyProfit);
        console.log('=== END DEBUG ===');

        // Fetch active configuration for phase calculations
        const config = await getActiveConfiguration(userId, req.user.branchId);

        // Calculate details for ALL active/pending investments
        const activeInvestments = activeSalesForROI.map(sale => {
            const productStatus = sale.productStatus || 'without_product';
            const phases = getAllPhases(productStatus, config);
            const monthsCompleted = sale.monthsCompleted || 0;

            let currentPhase = 1;
            let profitRate = sale.investorProfit || 0.05;
            let phaseFound = false;
            let accumulatedMonths = 0;

            for (const p of phases) {
                if (monthsCompleted < (accumulatedMonths + p.months)) {
                    currentPhase = p.phase;
                    profitRate = p.rate;
                    phaseFound = true;
                    break;
                }
                accumulatedMonths += p.months;
            }

            if (!phaseFound && phases.length > 0) {
                const lastPhase = phases[phases.length - 1];
                currentPhase = lastPhase.phase;
                profitRate = lastPhase.rate;
            }

            return {
                _id: sale._id,
                amount: sale.amount,
                currentPhase,
                profitRate,
                productStatus,
                date: sale.createdAt,
                totalProfit: sale.totalProfitEarned || 0,
                monthlyProfit: sale.amount * profitRate
            };
        });

        // Use the latest investment for the main "Summary" display (fallback)
        const latestInvestment = activeInvestments.length > 0 ? activeInvestments[0] : null;
        const currentPhase = latestInvestment ? latestInvestment.currentPhase : 1;
        const profitRate = latestInvestment ? latestInvestment.profitRate : 0.05;

        // Calculate available balance
        const availableBalance = await calculateBalance(userId);

        // Get user info
        const user = await User.findById(userId).select('name userName role');
        const referralId = user.userName || `SD-${userId.toString().slice(-5).toUpperCase()}`;

        // Determine rank based on business volume or level
        let rank = 'Sales Executive';
        if (totalBusinessVolume >= 10000000) rank = 'Diamond Partner';
        else if (totalBusinessVolume >= 5000000) rank = 'Platinum Partner';
        else if (totalBusinessVolume >= 1000000) rank = 'Gold Partner';
        else if (totalBusinessVolume >= 500000) rank = 'Silver Partner';

        // Calculate level achievements based on SWAMP DEER 8-tier system
        const levels = [
            { id: 1, no: '01', name: 'Sales Executive', criteria: 'Rs 15 Lac / 30 Lac', directReq: 1500000, totalReq: 3000000, reward: 'Tour Northern Areas', status: 'locked' },
            { id: 2, no: '02', name: 'Sales Officer', criteria: 'Rs 45 Lac / 90 Lac', directReq: 4500000, totalReq: 9000000, reward: 'Android Phone', status: 'locked' },
            { id: 3, no: '03', name: 'Sales Manager', criteria: 'Rs 135 Lac / 2.7 CR', directReq: 13500000, totalReq: 27000000, reward: 'iPhone', status: 'locked' },
            { id: 4, no: '04', name: 'Regional Sales Manager', criteria: 'Rs 4.05 CR / 8.1 CR', directReq: 40500000, totalReq: 81000000, reward: 'Alto Car', status: 'locked' },
            { id: 5, no: '05', name: 'Regional Director', criteria: 'Rs 12.15 CR / 24.3 CR', directReq: 121500000, totalReq: 243000000, reward: 'Honda City', status: 'locked' },
            { id: 6, no: '06', name: 'Zonal Head', criteria: 'Rs 36.45 CR / 72.9 CR', directReq: 364500000, totalReq: 729000000, reward: 'Jacco 5 SUV', status: 'locked' },
            { id: 7, no: '07', name: 'Director', criteria: 'Rs 109.35 CR / 218.7 CR', directReq: 1093500000, totalReq: 2187000000, reward: 'Tank 500', status: 'locked' },
            { id: 8, no: '08', name: 'Ambassador', criteria: 'Rs 328.05 CR / 656.1 CR', directReq: 3280500000, totalReq: 6561000000, reward: 'Beautiful Villa or 5 CR Cash', status: 'locked' },
        ];

        // Get existing gift requests (sorted by newest first)
        const giftRequests = await RankGiftRequest.find({ userId }).sort({ createdAt: -1 });

        // Get all approved rewards for direct team members (for leg achievement)
        const directTeamRewards = await RankGiftRequest.find({
            userId: { $in: directTeamIds },
            status: 'approved'
        });

        // Find user's most recent approved reward for fresh sales calculation
        const lastApprovedReward = await RankGiftRequest.findOne({
            userId,
            status: 'approved'
        }).sort({ approvedAt: -1 });

        const freshSalesStartDate = lastApprovedReward?.approvedAt || null;

        // Calculate fresh sales if there's a previous reward
        let freshDirectBusinessVolume = directBusinessVolume;
        let freshTotalBusinessVolume = totalBusinessVolume;

        if (freshSalesStartDate) {
            // Recalculate business volumes with date filter for fresh sales
            const freshBusinessAggregation = await Sale.aggregate([
                {
                    $match: {
                        user: { $in: allTeamIds },
                        status: { $in: ['completed', 'active'] },
                        createdAt: { $gte: freshSalesStartDate }
                    }
                },
                {
                    $group: {
                        _id: '$user',
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);

            freshDirectBusinessVolume = 0;
            freshTotalBusinessVolume = 0;

            freshBusinessAggregation.forEach(item => {
                const itemUserId = item._id.toString();

                // Only count TEAM sales for total volume (exclude user's own)
                if (itemUserId !== userId.toString()) {
                    freshTotalBusinessVolume += item.totalAmount;
                }

                // Only count direct team sales (NOT user's own sales)
                if (directTeamIds.some(id => id.toString() === itemUserId)) {
                    freshDirectBusinessVolume += item.totalAmount;
                }
            });
        }

        levels.forEach(level => {
            // Count how many direct legs have achieved this rank
            const legsAchieved = directTeamRewards.filter(r => r.rankId === level.id).length;
            level.legsAchieved = legsAchieved;
            level.legsRequired = 2;

            // Use fresh sales for progress calculation if there's a previous reward
            const directVolumeToUse = freshSalesStartDate ? freshDirectBusinessVolume : directBusinessVolume;
            const totalVolumeToUse = freshSalesStartDate ? freshTotalBusinessVolume : totalBusinessVolume;

            // Calculate progress
            const directProgress = Math.min(100, (directVolumeToUse / level.directReq) * 100);
            const totalProgress = Math.min(100, (totalVolumeToUse / level.totalReq) * 100);
            level.progress = Math.max(directProgress, totalProgress);

            level.remainingDirect = Math.max(0, level.directReq - directVolumeToUse);
            level.remainingTotal = Math.max(0, level.totalReq - totalVolumeToUse);

            // Add fresh sales info
            level.freshSales = freshSalesStartDate ? {
                directBusiness: freshDirectBusinessVolume,
                totalBusiness: freshTotalBusinessVolume,
                sinceDate: freshSalesStartDate
            } : null;

            // First, check if this level has an approved reward (takes precedence)
            const request = giftRequests.find(r => r.rankId === level.id);

            if (request && request.status === 'approved') {
                // If reward was approved, always show as achieved
                level.status = 'achieved';
                level.claimStatus = 'approved';
                level.isClaimed = true;
            } else {
                // Check if achieved: EITHER sales target met OR 2 legs achieved
                const salesTargetMet = directVolumeToUse >= level.directReq || totalVolumeToUse >= level.totalReq;
                const legsRequirementMet = legsAchieved >= 2;

                if (salesTargetMet || legsRequirementMet) {
                    level.status = 'achieved';

                    // Check claim status for pending/rejected requests
                    if (request) {
                        level.claimStatus = request.status; // pending or rejected
                        level.isClaimed = false;
                    } else {
                        level.claimStatus = 'not_claimed';
                        level.isClaimed = false;
                    }
                } else {
                    level.status = 'locked';
                }
            }
        });

        const response = {
            user: {
                name: user.name,
                referralId: referralId,
                rank: rank,
                role: user.role
            },
            kpis: {
                totalBusinessVolume,
                totalDirectBusiness: directBusinessVolume,
                totalIndirectBusiness: indirectBusinessVolume,
                totalProfitEarned,
                stakingIncome: stakingRewards,
                referralIncome,
                levelIncome,
                availableBalance,
                monthly: {
                    directBusiness: monthlyDirectBusiness,
                    stakingIncome: monthlyStakingIncome,
                    referralIncome: monthlyReferralIncome,
                    levelIncome: monthlyLevelIncome,
                    totalCommission: monthlyTotalCommission,
                }
            },
            teamStats: {
                totalTeamSize: directTeam.length + indirectTeam.length,
                directTeam: directTeam.length,
                indirectTeam: indirectTeam.length
            },
            investment: {
                totalInvestment: investmentStats.totalInvestment,
                totalProfit: investmentStats.totalProfit,
                monthlyProfit: monthlyProfit,
                roiStatus: investmentStats.totalInvestment > 0 ? 'Growing' : 'No Investment',
                currentPhase: currentPhase,
                profitRate: profitRate,
                activeInvestments: activeInvestments
            },
            rewards: {
                staking: stakingRewards,
                level: levelIncome,
                referral: referralIncome,
                total: totalProfitEarned
            },
            levels: levels
        };

        res.json(response);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDashboardStats };
