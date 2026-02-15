const Withdrawal = require('../models/Withdrawal');
const UserStakeReward = require('../models/UserStakingReward');
const User = require('../models/User');
const ResponseHelper = require('../utils/ResponseHelper');

/**
 * Calculate User Balance
 */
const calculateBalance = async (userId) => {
    const rewards = await UserStakeReward.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const withdrawals = await Withdrawal.aggregate([
        { $match: { userId: userId, status: { $in: ['approved', 'completed', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRewards = rewards.length > 0 ? rewards[0].total : 0;
    const totalWithdrawals = withdrawals.length > 0 ? withdrawals[0].total : 0;

    return totalRewards - totalWithdrawals;
};

// @desc    Request a withdrawal
// @route   POST /api/withdrawals
// @access  Private
const requestWithdrawal = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { amount, method, bankDetails } = req.body;

        if (!amount || amount <= 0) {
            response.message = "Invalid amount";
            return res.status(400).json(response);
        }

        const balance = await calculateBalance(req.user._id);

        if (balance < amount) {
            response.message = "Insufficient balance";
            return res.status(400).json(response);
        }

        // Apply 5% Withdrawal Fee (Gross)
        const fee = amount * 0.05;
        const netAmount = amount - fee;

        const withdrawalData = {
            userId: req.user._id,
            amount,
            status: 'pending',
            method: method || 'CASH'
        };

        if (method === 'BANK' && bankDetails) {
            withdrawalData.bankDetails = bankDetails;

            // Update user profile with these bank details for future use
            await User.findByIdAndUpdate(req.user._id, {
                bankDetails: bankDetails
            });
        }

        const withdrawal = await Withdrawal.create(withdrawalData);

        response.success = true;
        response.message = "Withdrawal request submitted successfully";
        response.status = 201;
        response.data = {
            withdrawal,
            fee,
            netAmount,
            remainingBalance: balance - amount
        };
    } catch (error) {
        console.error('Request Withdrawal Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

// @desc    Get withdrawal history
// @route   GET /api/withdrawals
// @access  Private
const getWithdrawals = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const query = req.user.role === 'super_admin' ? {} : { userId: req.user._id };

        const withdrawals = await Withdrawal.find(query)
            .populate('userId', 'name userName email phone')
            .sort({ createdAt: -1 });

        response.success = true;
        response.message = "Withdrawals retrieved successfully";
        response.status = 200;
        response.data = withdrawals;
    } catch (error) {
        console.error('Get Withdrawals Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

// @desc    Update withdrawal status (Admin)
// @route   PUT /api/withdrawals/:id/status
// @access  Private/Admin
const updateWithdrawalStatus = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { status } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.id);

        if (!withdrawal) {
            response.message = "Withdrawal not found";
            response.status = 404;
            return res.status(404).json(response);
        }

        withdrawal.status = status;
        await withdrawal.save();

        response.success = true;
        response.message = `Withdrawal status updated to ${status}`;
        response.status = 200;
        response.data = withdrawal;
    } catch (error) {
        console.error('Update Withdrawal Status Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

// @desc    Get current balance
// @route   GET /api/withdrawals/balance
// @access  Private
const getBalance = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const balance = await calculateBalance(req.user._id);

        response.success = true;
        response.message = "Balance retrieved successfully";
        response.status = 200;
        response.data = { balance };
    } catch (error) {
        console.error('Get Balance Error:', error);
        response.message = error.message;
        response.status = 500;
    } finally {
        return res.status(response.status).json(response);
    }
};

module.exports = {
    requestWithdrawal,
    getWithdrawals,
    updateWithdrawalStatus,
    getBalance,
    calculateBalance
};
