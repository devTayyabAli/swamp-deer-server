const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        default: 0,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending',
    },
    method: {
        type: String,
        enum: ['CASH', 'BANK'],
        default: 'CASH',
    },
    bankDetails: {
        accountNumber: String,
        bankName: String,
        ifscCode: String,
        accountHolderName: String,
        branchName: String,
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    },
},
    {
        timestamps: true,
    }
);

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
