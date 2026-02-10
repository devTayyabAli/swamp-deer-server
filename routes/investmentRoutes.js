const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getInvestmentPlans,
    getUserStakes,
    getStakeDetails
} = require('../controllers/investmentController');

// Define API routes for investments
router.route('/plans').get(getInvestmentPlans);
router.route('/my-stakes').get(protect, getUserStakes);
router.route('/:id').get(protect, getStakeDetails);

module.exports = router;
