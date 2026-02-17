const mongoose = require('mongoose');

const adminActivityLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    adminName: {
        type: String,
        required: true
    },
    adminEmail: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    actionCategory: {
        type: String,
        required: true,
        enum: ['WITHDRAWAL', 'SALE', 'REWARD', 'USER', 'PLAN', 'BRANCH', 'OTHER'],
        index: true
    },
    targetType: {
        type: String,
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    targetName: {
        type: String,
        required: false
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    success: {
        type: Boolean,
        default: true
    },
    errorMessage: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Index for efficient querying
adminActivityLogSchema.index({ createdAt: -1 });
adminActivityLogSchema.index({ admin: 1, createdAt: -1 });
adminActivityLogSchema.index({ actionCategory: 1, createdAt: -1 });

const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivityLogSchema);

module.exports = AdminActivityLog;
