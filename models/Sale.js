const mongoose = require('mongoose');

const saleSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    investorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    customerName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    commission: {
        type: Number,
        required: true
    },
    investorProfit: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'rejected', 'active', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash in hand', 'Bank account'],
        required: true
    },
    productStatus: {
        type: String,
        enum: ['with_product', 'without_product'],
        default: 'without_product'
    },
    // Investment Tracking Fields (from Stake)
    duration: {
        type: Number, // in days (365 for 12 months)
    },
    rewardPercentage: {
        type: Number, // monthly rate (e.g. 0.05)
    },
    endDate: {
        type: Date,
    },
    lastRewardAt: {
        type: Date,
        default: null,
    },
    currentPhase: {
        type: Number,
        default: 1,
        min: 1
    },
    phaseStartDate: {
        type: Date,
        default: Date.now
    },
    monthsCompleted: {
        type: Number,
        default: 0,
        min: 0
    },
    totalProfitEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    profitCap: {
        type: Number,
        // Set to 5× investment amount on completion
    }
}, {
    timestamps: true
});

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;
