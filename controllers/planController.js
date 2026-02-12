const InvestmentPlan = require('../models/InvestmentPlan');
const ResponseHelper = require('../utils/ResponseHelper');

// @desc    Get investment plan configuration for a specific scope
// @route   GET /api/plans
// @access  Private/Admin
const getPlans = async (req, res) => {
    try {
        const { scope, scopeId } = req.query;
        let query = {};
        if (scope) query.scope = scope;
        if (scopeId) query.scopeId = scopeId;

        const plans = await InvestmentPlan.find(query);
        res.json(ResponseHelper.getResponse(true, 'Investment plans fetched successfully', plans));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

// @desc    Create or update an investment plan (Global, Branch, or User scope)
// @route   POST /api/plans
// @access  Private/Admin
const upsertPlan = async (req, res) => {
    try {
        const {
            scope,
            scopeId,
            referralBonusRates,
            matchingBonusRates,
            withProductPhases,
            withoutProductPhases,
            rankTargets,
            profitCapMultiplier
        } = req.body;

        if (!['global', 'branch', 'user'].includes(scope)) {
            return res.status(400).json(ResponseHelper.getResponse(false, 'Invalid scope'));
        }

        if (scope !== 'global' && !scopeId) {
            return res.status(400).json(ResponseHelper.getResponse(false, 'ScopeId is required for non-global plans'));
        }

        const filter = { scope };
        if (scopeId) filter.scopeId = scopeId;

        const update = {
            referralBonusRates,
            matchingBonusRates,
            withProductPhases,
            withoutProductPhases,
            rankTargets,
            profitCapMultiplier
        };

        const plan = await InvestmentPlan.findOneAndUpdate(
            filter,
            { $set: update },
            { new: true, upsert: true, runValidators: true }
        );

        res.json(ResponseHelper.getResponse(true, `Investment plan for ${scope} updated successfully`, plan));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

// @desc    Delete a specific override plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
const deletePlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json(ResponseHelper.getResponse(false, 'Plan not found'));
        }

        if (plan.scope === 'global') {
            return res.status(400).json(ResponseHelper.getResponse(false, 'Global plan cannot be deleted'));
        }

        await InvestmentPlan.findByIdAndDelete(req.params.id);
        res.json(ResponseHelper.getResponse(true, 'Override plan deleted successfully'));
    } catch (error) {
        res.status(500).json(ResponseHelper.getResponse(false, error.message));
    }
};

module.exports = {
    getPlans,
    upsertPlan,
    deletePlan
};
