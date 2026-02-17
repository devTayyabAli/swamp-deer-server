const express = require('express');
const router = express.Router();
const { getActivityLogs, getActiveAdmins } = require('../controllers/activityLogController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require authentication and admin privileges
router.use(protect);
router.use(admin);

// GET /api/admin/activity-logs - Get activity logs with filters
router.get('/', getActivityLogs);

// GET /api/admin/activity-logs/admins - Get list of admins
router.get('/admins', getActiveAdmins);

module.exports = router;
