const mongoose = require('mongoose');
const UserStakeReward = require('../models/UserStakingReward');
const RankGiftRequest = require('../models/RankGiftRequest');
const Gift = require('../models/Gift');
const Sale = require('../models/Sale');
const User = require('../models/User');
const ResponseHelper = require('../utils/ResponseHelper');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get reward summary for the current user
// @route   GET /api/rewards/summary
// @access  Private
const getRewardSummary = async (req, res) => {
    try {
        const rewards = await UserStakeReward.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const summary = {
            staking: 0,
            level: 0,
            referral: 0,
            total: 0
        };

        rewards.forEach(reward => {
            if (reward._id === 'staking') summary.staking = reward.total;
            if (reward._id === 'level_income') summary.level = reward.total;
            if (reward._id === 'direct_income') summary.referral = reward.total;
            summary.total += reward.total;
        });

        res.json(ResponseHelper.getResponse(true, 'Reward summary fetched successfully', summary));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

// @desc    Get rewards list for the current user
// @route   GET /api/rewards
// @access  Private
const getRewards = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { type, startDate, endDate, level } = req.query;
        const query = { userId: req.user._id };
        if (type) query.type = type;

        // Date Filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Level Filter (if level is stored in schema or description)
        if (level) {
            // Check if level is numeric or string match
            // query.level = level; // Assuming level is added to schema in future
        }

        const countPromise = UserStakeReward.countDocuments(query);
        const rewardsPromise = UserStakeReward.find(query)
            .populate({
                path: 'stakeId',
                select: 'user amount productStatus',
                populate: { path: 'user', select: 'name userName email' }
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        // Calculate Total for this filtered view
        const totalAggregationPromise = UserStakeReward.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const [count, rewards, totalAggregation] = await Promise.all([
            countPromise,
            rewardsPromise,
            totalAggregationPromise
        ]);

        const filteredTotal = totalAggregation.length > 0 ? totalAggregation[0].total : 0;

        res.json(ResponseHelper.getResponse(true, 'Rewards fetched successfully', {
            items: rewards,
            page,
            pages: Math.ceil(count / limit),
            total: count,
            filteredTotal: filteredTotal
        }));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

// @desc    Claim a rank gift
// @route   POST /api/rewards/claim
// @access  Private
const claimRankGift = async (req, res) => {
    try {
        const { rankId } = req.body;
        const userId = req.user._id;

        // 1. Verify if already claimed (only block if pending or approved)
        const existingRequest = await RankGiftRequest.findOne({
            userId,
            rankId,
            status: { $in: ['pending', 'approved'] }
        });
        if (existingRequest) {
            let response = ResponseHelper.getResponse(false, 'Reward already claimed or pending for this rank', {}, 400);
            return res.status(400).json(response);
        }

        // 2. Define requirements (must match dashboardController)
        const levels = [
            { id: 1, directReq: 1500000, totalReq: 3000000 },
            { id: 2, directReq: 4500000, totalReq: 9000000 },
            { id: 3, directReq: 13500000, totalReq: 27000000 },
            { id: 4, directReq: 40500000, totalReq: 81000000 },
            { id: 5, directReq: 121500000, totalReq: 243000000 },
            { id: 6, directReq: 364500000, totalReq: 729000000 },
            { id: 7, directReq: 1093500000, totalReq: 2187000000 },
            { id: 8, directReq: 3280500000, totalReq: 6561000000 },
        ];

        const level = levels.find(l => l.id === Number(rankId));
        if (!level) {
            let response = ResponseHelper.getResponse(false, 'Invalid rank ID', {}, 400);
            return res.status(400).json(response);
        }

        // 3. Get team structure for validation
        const directTeam = await User.find({ upline: userId });
        const directTeamIds = directTeam.map(member => member._id);

        // 4. Get Fresh Sales Baseline Date (NEW)
        // Find the user's most recent approved reward to determine baseline date for fresh sales
        const lastApprovedReward = await RankGiftRequest.findOne({
            userId,
            status: 'approved'
        }).sort({ approvedAt: -1 });

        const freshSalesStartDate = lastApprovedReward?.approvedAt || null;

        // 5. Calculate business volumes (with fresh sales filter)
        const getIndirectTeam = async (userIds) => {
            const children = await User.find({ upline: { $in: userIds } });
            if (children.length === 0) return [];
            const childIds = children.map(c => c._id);
            const grandChildren = await getIndirectTeam(childIds);
            return [...children, ...grandChildren];
        };

        const indirectTeam = directTeamIds.length > 0 ? await getIndirectTeam(directTeamIds) : [];
        const indirectTeamIds = indirectTeam.map(member => member._id);
        // Only count TEAM sales (exclude user's own sales)
        const allTeamIds = [...directTeamIds, ...indirectTeamIds];

        // Build sales match criteria with fresh sales date filter
        const salesMatchCriteria = {
            user: { $in: allTeamIds },
            status: { $in: ['completed', 'active'] }
        };

        // Only count sales AFTER the last approved reward (fresh sales)
        if (freshSalesStartDate) {
            salesMatchCriteria.createdAt = { $gte: freshSalesStartDate };
        }

        const businessAggregation = await Sale.aggregate([
            { $match: salesMatchCriteria },
            {
                $group: {
                    _id: '$user',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        let totalBusinessVolume = 0;
        let directBusinessVolume = 0;

        businessAggregation.forEach(item => {
            const itemUserId = item._id.toString();
            totalBusinessVolume += item.totalAmount;

            // Only count direct team sales (NOT user's own sales)
            if (directTeamIds.some(id => id.toString() === itemUserId)) {
                directBusinessVolume += item.totalAmount;
            }
        });

        // 6. Check eligibility: EITHER Leg Achievement OR Sales Target (not both required)
        // Count approved legs
        const approvedLegs = await RankGiftRequest.countDocuments({
            userId: { $in: directTeamIds },
            rankId: level.id,
            status: 'approved'
        });

        const hasEnoughLegs = approvedLegs >= 2;
        const hasEnoughSales = directBusinessVolume >= level.directReq || totalBusinessVolume >= level.totalReq;

        // User needs EITHER 2 legs OR enough sales
        if (!hasEnoughLegs && !hasEnoughSales) {
            const salesType = freshSalesStartDate ? 'fresh sales (since last reward)' : 'total sales';
            let response = ResponseHelper.getResponse(
                false,
                `You need to meet at least ONE of these requirements:\n` +
                `Option 1: Have 2 direct legs with approved Rank ${level.id} rewards (currently ${approvedLegs}/2 legs)\n` +
                `Option 2: Achieve Rs ${level.directReq.toLocaleString()} in direct ${salesType} OR Rs ${level.totalReq.toLocaleString()} in total ${salesType}`,
                {},
                400
            );
            return res.status(400).json(response);
        }

        // 7. Find the gift
        const gift = await Gift.findOne({ rankId: level.id });
        if (!gift) {
            let response = ResponseHelper.getResponse(false, 'Gift configuration not found for this rank', {}, 404);
            return res.status(404).json(response);
        }

        // 7. Create request
        const request = await RankGiftRequest.create({
            userId,
            rankId: level.id,
            giftId: gift._id,
            status: 'pending'
        });

        res.json(ResponseHelper.getResponse(true, 'Reward claim submitted successfully. Admin will review your request.', request));

    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message, {}, 500));
    }
};

// @desc    Get all reward requests (Admin only)
// @route   GET /api/rewards/requests
// @access  Private/Admin
const getAllRewardRequests = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { status } = req.query;
        const query = {};
        if (status) query.status = status;

        const count = await RankGiftRequest.countDocuments(query);
        const requests = await RankGiftRequest.find(query)
            .populate('userId', 'name userName email')
            .populate('giftId')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        res.json(ResponseHelper.getResponse(true, 'Reward requests fetched successfully', {
            items: requests,
            page,
            pages: Math.ceil(count / limit),
            total: count
        }));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message, {}, 500));
    }
};

// @desc    Update reward request status (Admin only)
// @route   PUT /api/rewards/requests/:id
// @access  Private/Admin
const updateRewardRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const requestId = req.params.id;

        if (!['approved', 'rejected'].includes(status)) {
            let response = ResponseHelper.getResponse(false, 'Invalid status', {}, 400);
            return res.status(400).json(response);
        }

        const request = await RankGiftRequest.findById(requestId).populate('userId', 'name email');
        if (!request) {
            let response = ResponseHelper.getResponse(false, 'Reward request not found', {}, 404);
            return res.status(404).json(response);
        }

        const oldStatus = request.status;
        request.status = status;
        request.processedBy = req.user._id;

        // Set approvedAt timestamp when status changes to approved
        if (status === 'approved') {
            request.approvedAt = new Date();
        }

        await request.save();

        // Log admin activity
        await logActivity({
            admin: req.user,
            action: status === 'approved' ? 'APPROVE_REWARD' : 'REJECT_REWARD',
            actionCategory: 'REWARD',
            targetType: 'RankGiftRequest',
            targetId: request._id,
            targetName: `${request.userId?.name || 'Unknown User'} - Rank ${request.rankId} Reward`,
            changes: {
                status: { from: oldStatus, to: status }
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json(ResponseHelper.getResponse(true, `Reward request ${status} successfully`, request));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message, {}, 500));
    }
};

// @desc    Get rewards list for a specific user (Admin only)
// @route   GET /api/rewards/investor/:id
// @access  Private/Admin
const getInvestorRewards = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { type, startDate, endDate } = req.query;
        const userId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json(ResponseHelper.getResponse(false, 'Invalid Investor ID'));
        }

        const objectId = new mongoose.Types.ObjectId(userId);

        const query = { userId: objectId };
        if (type) query.type = type;

        // Date Filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const countPromise = UserStakeReward.countDocuments(query);
        const rewardsPromise = UserStakeReward.find(query)
            .populate({
                path: 'stakeId',
                select: 'user amount productStatus',
                populate: { path: 'user', select: 'name userName email' }
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const [count, rewards, totalAggregation] = await Promise.all([
            countPromise,
            rewardsPromise,
            UserStakeReward.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const filteredTotal = totalAggregation.length > 0 ? totalAggregation[0].total : 0;

        res.json(ResponseHelper.getResponse(true, 'Investor rewards fetched successfully', {
            items: rewards,
            page,
            pages: Math.ceil(count / limit),
            total: count,
            filteredTotal: filteredTotal
        }));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

module.exports = {
    getRewardSummary,
    getRewards,
    claimRankGift,
    getAllRewardRequests,
    updateRewardRequestStatus,
    getInvestorRewards
};
