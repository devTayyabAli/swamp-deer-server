const mongoose = require("mongoose");

const transactionLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        action: { type: String, required: true },
        details: { type: Object },
        error: { type: String },
    },
    {
        timestamps: true,
    }
);
const TransactionLog = mongoose.model("TransactionLog", transactionLogSchema);

module.exports = TransactionLog;
