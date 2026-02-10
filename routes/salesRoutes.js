const express = require('express');
const router = express.Router();
const { getSales, createSale, updateSaleStatus } = require('../controllers/salesController');
const { protect, admin } = require('../middleware/authMiddleware');

const { uploadPayload } = require('../middleware/uploadMiddleware');

router.route('/')
    .get(protect, getSales)
    .post(protect, uploadPayload.single('receipt'), createSale);
router.route('/:id/status').put(protect, admin, updateSaleStatus);

module.exports = router;
