const express = require('express');
const router = express.Router();
const { getSales, createSale, updateSaleStatus } = require('../controllers/salesController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(protect, getSales).post(protect, createSale);
router.route('/:id/status').put(protect, admin, updateSaleStatus);

module.exports = router;
