const mongoose = require("mongoose");

const cronLogSchema = new mongoose.Schema(
    {
        jobName: { type: String, required: true },
        status: { type: String, enum: ['success', 'failed'], required: true },
        details: { type: String },
        error: { type: String },
    },
    { timestamps: true }
);

const CronLog = mongoose.model("CronLog", cronLogSchema);

module.exports = CronLog;
