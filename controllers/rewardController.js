const UserStakeReward = require('../models/UserStakingReward');
const RankGiftRequest = require('../models/RankGiftRequest');
const Gift = require('../models/Gift');
const Sale = require('../models/Sale');
const User = require('../models/User');
const ResponseHelper = require('../utils/ResponseHelper');

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

        const { type } = req.query;
        const query = { userId: req.user._id };
        if (type) query.type = type;

        const count = await UserStakeReward.countDocuments(query);
        const rewards = await UserStakeReward.find(query)
            .populate('stakeId')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        res.json(ResponseHelper.getResponse(true, 'Rewards fetched successfully', {
            items: rewards,
            page,
            pages: Math.ceil(count / limit),
            total: count
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

        // 1. Verify if already claimed
        const existingRequest = await RankGiftRequest.findOne({ userId, rankId });
        if (existingRequest) {
            return res.status(400).json(ResponseHelper.getResponse(false, 'Reward already claimed or pending for this rank'));
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
            return res.status(400).json(ResponseHelper.getResponse(false, 'Invalid rank ID'));
        }

        // 3. Verify business volume eligibility
        // (Similar logic to dashboardController)
        const directTeam = await User.find({ upline: userId });
        const directTeamIds = directTeam.map(member => member._id);

        const getIndirectTeam = async (userIds) => {
            const children = await User.find({ upline: { $in: userIds } });
            if (children.length === 0) return [];
            const childIds = children.map(c => c._id);
            const grandChildren = await getIndirectTeam(childIds);
            return [...children, ...grandChildren];
        };

        const indirectTeam = directTeamIds.length > 0 ? await getIndirectTeam(directTeamIds) : [];
        const indirectTeamIds = indirectTeam.map(member => member._id);
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

            if (itemUserId === userId.toString() || directTeamIds.some(id => id.toString() === itemUserId)) {
                directBusinessVolume += item.totalAmount;
            }
        });

        if (directBusinessVolume < level.directReq && totalBusinessVolume < level.totalReq) {
            return res.status(400).json(ResponseHelper.getResponse(false, 'You have not achieved the business volume required for this reward'));
        }

        // 4. Find the gift
        const gift = await Gift.findOne({ rankId: level.id });
        if (!gift) {
            return res.status(404).json(ResponseHelper.getResponse(false, 'Gift configuration not found for this rank'));
        }

        // 5. Create request
        const request = await RankGiftRequest.create({
            userId,
            rankId: level.id,
            giftId: gift._id,
            status: 'pending'
        });

        res.json(ResponseHelper.getResponse(true, 'Reward claim submitted successfully. Admin will review your request.', request));

    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
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
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
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
            return res.status(400).json(ResponseHelper.getResponse(false, 'Invalid status'));
        }

        const request = await RankGiftRequest.findById(requestId);
        if (!request) {
            return res.status(404).json(ResponseHelper.getResponse(false, 'Reward request not found'));
        }

        request.status = status;
        request.processedBy = req.user._id;
        await request.save();

        res.json(ResponseHelper.getResponse(true, `Reward request ${status} successfully`, request));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

module.exports = {
    getRewardSummary,
    getRewards,
    claimRankGift,
    getAllRewardRequests,
    updateRewardRequestStatus
};
