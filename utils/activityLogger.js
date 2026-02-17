const AdminActivityLog = require('../models/AdminActivityLog');

/**
 * Log an admin activity
 * @param {Object} params - Activity parameters
 * @param {Object} params.admin - Admin user object (from req.user)
 * @param {String} params.action - Action performed (e.g., 'APPROVE_WITHDRAWAL')
 * @param {String} params.actionCategory - Category (WITHDRAWAL, SALE, REWARD, USER, etc.)
 * @param {String} params.targetType - Type of target entity
 * @param {String} params.targetId - ID of target entity
 * @param {String} params.targetName - Display name of target
 * @param {Object} params.changes - Before/after changes object
 * @param {String} params.ipAddress - IP address of admin
 * @param {String} params.userAgent - User agent string
 * @param {Boolean} params.success - Whether action succeeded
 * @param {String} params.errorMessage - Error message if failed
 */
const logActivity = async ({
    admin,
    action,
    actionCategory,
    targetType,
    targetId = null,
    targetName = null,
    changes = null,
    ipAddress = null,
    userAgent = null,
    success = true,
    errorMessage = null
}) => {
    try {
        await AdminActivityLog.create({
            admin: admin._id,
            adminName: admin.name,
            adminEmail: admin.email,
            action,
            actionCategory,
            targetType,
            targetId,
            targetName,
            changes,
            ipAddress,
            userAgent,
            success,
            errorMessage
        });
    } catch (error) {
        // Don't throw error to prevent disrupting the main flow
        console.error('Failed to log admin activity:', error);
    }
};

module.exports = { logActivity };
