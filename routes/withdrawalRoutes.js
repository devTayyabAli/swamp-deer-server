const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawals, updateWithdrawalStatus, getBalance } = require('../controllers/withdrawalController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getWithdrawals)
    .post(protect, requestWithdrawal);

router.get('/balance', protect, getBalance);

router.route('/:id/status')
    .put(protect, admin, updateWithdrawalStatus);

module.exports = router;
