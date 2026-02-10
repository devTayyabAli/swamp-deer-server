const mongoose = require("mongoose");

const giftSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        amount: { type: Number, required: false, default: 0 },
        rankId: { type: Number, required: false }
    },
    { timestamps: true },
);

const Gift = mongoose.model("Gift", giftSchema);

module.exports = Gift;
