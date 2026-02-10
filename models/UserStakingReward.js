const mongoose = require('mongoose');

const userStakeRewardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    stakeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
        required: true,
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['staking', 'level_income', 'direct_income'],
        required: true
    }
},
    { timestamps: true },
);

const UserStakeReward = mongoose.model('UserStakeReward', userStakeRewardSchema);

module.exports = UserStakeReward;
