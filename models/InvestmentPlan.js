const mongoose = require('mongoose');

const investmentPlanSchema = new mongoose.Schema({
    scope: {
        type: String,
        enum: ['global', 'branch', 'user'],
        default: 'global',
        required: true
    },
    scopeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: function () { return this.scope !== 'global'; },
        // Could be a Branch ID or a User ID (for team-specific settings)
    },
    // Referral Bonuses (%) - Level 1 to 8
    referralBonusRates: {
        type: [Number],
        default: [0.06, 0.025, 0.02, 0.015, 0.015, 0.01, 0.01, 0.005]
    },
    // Matching Bonuses (Profit Share %) - Level 1 to 8
    matchingBonusRates: {
        type: [Number],
        default: [0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01]
    },
    // ROI Phase Configs
    withProductPhases: [{
        phase: Number,
        months: Number,
        rate: Number,
        description: String
    }],
    withoutProductPhases: [{
        phase: Number,
        months: Number,
        rate: Number,
        description: String
    }],
    // Rank Targets
    rankTargets: [{
        rankId: Number,
        title: String,
        withoutProduct: Number, // Threshold for without-product plan
        withProduct: Number,    // Threshold for with-product plan
    }],
    // Multipliers
    profitCapMultiplier: {
        type: Number,
        default: 5
    }
}, { timestamps: true });

// Ensure only one global config and unique scope/scopeId pairs
investmentPlanSchema.index({ scope: 1, scopeId: 1 }, { unique: true });

const InvestmentPlan = mongoose.model('InvestmentPlan', investmentPlanSchema);
module.exports = InvestmentPlan;
