const AdminActivityLog = require('../models/AdminActivityLog');
const User = require('../models/User');
const ResponseHelper = require('../utils/ResponseHelper');

// @desc    Get activity logs with filters
// @route   GET /api/admin/activity-logs
// @access  Private/Admin
const getActivityLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            adminId,
            actionCategory,
            startDate,
            endDate,
            search
        } = req.query;

        // Build query
        const query = {};

        if (adminId) {
            query.admin = adminId;
        }

        if (actionCategory && actionCategory !== 'ALL') {
            query.actionCategory = actionCategory;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        if (search) {
            query.$or = [
                { adminName: { $regex: search, $options: 'i' } },
                { adminEmail: { $regex: search, $options: 'i' } },
                { targetName: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const logs = await AdminActivityLog.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const totalCount = await AdminActivityLog.countDocuments(query);
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        res.json(ResponseHelper.getResponse(true, 'Activity logs retrieved successfully', {
            logs,
            totalCount,
            page: parseInt(page),
            totalPages,
            limit: parseInt(limit)
        }));
    } catch (error) {
        console.error('Get Activity Logs Error:', error);
        res.status(500).json(ResponseHelper.getResponse(false, error.message, {}, 500));
    }
};

// @desc    Get list of admins who have performed actions
// @route   GET /api/admin/activity-logs/admins
// @access  Private/Admin
const getActiveAdmins = async (req, res) => {
    try {
        const admins = await AdminActivityLog.distinct('admin');
        const adminDetails = await User.find({ _id: { $in: admins } }).select('name email');

        res.json(ResponseHelper.getResponse(true, 'Active admins retrieved successfully', adminDetails));
    } catch (error) {
        console.error('Get Active Admins Error:', error);
        res.status(500).json(ResponseHelper.getResponse(false, error.message, {}, 500));
    }
};

module.exports = { getActivityLogs, getActiveAdmins };
