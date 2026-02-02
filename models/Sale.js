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
        enum: ['pending', 'completed', 'rejected'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash in hand', 'Bank account'],
        required: true
    },
    documentPath: {
        type: String
    }
}, {
    timestamps: true
});

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;
