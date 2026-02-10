const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: [
                "staking",
                "register",
                "withdraw",
                "fundsTransfer",
                "buyToken",
                "sellToken",
                "levelIncome",
                "stakingReward"
            ],
            default: "register",
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
        },
        amount: {
            type: Number,
            default: 0,
        },
        txHash: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
