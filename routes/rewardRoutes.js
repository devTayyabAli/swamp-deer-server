const express = require('express');
const router = express.Router();
const {
    getRewardSummary,
    getRewards,
    claimRankGift,
    getAllRewardRequests,
    updateRewardRequestStatus
} = require('../controllers/rewardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/summary', protect, getRewardSummary);
router.get('/', protect, getRewards);
router.post('/claim', protect, claimRankGift);

// Admin Routes
router.get('/requests', protect, admin, getAllRewardRequests);
router.put('/requests/:id', protect, admin, updateRewardRequestStatus);

module.exports = router;
