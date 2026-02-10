const mongoose = require("mongoose");

const userRankSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        rankId: {
            type: Number,
            required: false,
        },
        processedAt: { type: Date, default: null, required: false },
    },
    {
        timestamps: true,
    }
);

const UserRank = mongoose.model("UserRank", userRankSchema);

module.exports = UserRank;
