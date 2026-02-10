const mongoose = require("mongoose");

const rankGiftRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        rankId: {
            type: Number,
            required: true,
        },
        giftId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gift",
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
    },
    { timestamps: true }
);

const RankGiftRequest = mongoose.model("RankGiftRequest", rankGiftRequestSchema);

module.exports = RankGiftRequest;
