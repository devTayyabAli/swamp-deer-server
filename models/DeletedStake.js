const mongoose = require('mongoose');

const deletedStakeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    stakeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    amount: {
        type: Number,
        required: true
    },
    reason: {
        type: String
    },
    deletedAt: {
        type: Date,
        default: Date.now
    }
},
    { timestamps: true },
);

const DeletedStake = mongoose.model('DeletedStake', deletedStakeSchema);

module.exports = DeletedStake;
