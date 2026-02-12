const express = require('express');
const router = express.Router();
const { getPlans, upsertPlan, deletePlan } = require('../controllers/planController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, admin, getPlans)
    .post(protect, admin, upsertPlan);

router.route('/:id')
    .delete(protect, admin, deletePlan);

module.exports = router;
