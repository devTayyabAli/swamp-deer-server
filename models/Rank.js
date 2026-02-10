const mongoose = require('mongoose');

const RankSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        saleTargetCash: {
            type: Number,
            required: false,
        },
        saleTargetProducts: {
            type: Number,
            required: false,
        },
        reward: {
            type: String,
            required: false,
        },
        directIndirectPercentage: {
            type: Number,
            required: false,
        },
        profitSharePercentage: {
            type: Number,
            required: false,
        },
        monthlyProfitSharePercentage: {
            type: Number,
            required: false,
        },
        rankId: {
            type: Number,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

const Rank = mongoose.model("Rank", RankSchema);

module.exports = Rank;
