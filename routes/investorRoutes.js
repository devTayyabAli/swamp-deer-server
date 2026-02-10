const express = require('express');
const router = express.Router();
const { getInvestors, createInvestor, updateInvestorStatus, getInvestorTeam, getPartnerProfileWithStats } = require('../controllers/investorController');
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(protect, getInvestors).post(protect, createInvestor);
router.route('/profile').get(protect, getPartnerProfileWithStats);
router.route('/dashboard/stats').get(protect, getDashboardStats);
router.route('/:id/status').put(protect, admin, updateInvestorStatus);
router.route('/team').get(protect, getInvestorTeam);
router.route('/:id/team').get(protect, getInvestorTeam);

module.exports = router;
