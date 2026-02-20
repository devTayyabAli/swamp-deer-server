const Branch = require('../models/Branch');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public (or Private)
const getBranches = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build sales filter for lookup
        const salesFilter = { status: { $in: ['completed', 'active'] } };
        if (startDate || endDate) {
            salesFilter.createdAt = {};
            if (startDate) salesFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                salesFilter.createdAt.$lte = end;
            }
        }

        const branches = await Branch.aggregate([
            {
                $lookup: {
                    from: 'sales',
                    let: { branchId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$branchId', '$$branchId'] },
                                ...salesFilter
                            }
                        }
                    ],
                    as: 'sales'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { branchId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$branchId', '$$branchId'] },
                                role: 'investor'
                            }
                        }
                    ],
                    as: 'linkedInvestors'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'manager',
                    foreignField: '_id',
                    as: 'manager'
                }
            },
            {
                $unwind: {
                    path: '$manager',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    totalSalesAmount: { $sum: '$sales.amount' },
                    totalProfit: {
                        $reduce: {
                            input: '$sales',
                            initialValue: 0,
                            in: { $add: ['$$value', { $subtract: ['$$this.amount', '$$this.commission'] }] }
                        }
                    },
                    linkedInvestorsCount: { $size: '$linkedInvestors' }
                }
            },
            {
                $project: {
                    sales: 0,
                    linkedInvestors: 0,
                    'manager.password': 0,
                    'manager.resetPasswordToken': 0,
                    'manager.resetPasswordExpires': 0
                }
            }
        ]);
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private
const createBranch = async (req, res) => {
    const { name, city, state, address, manager } = req.body;

    if (!name || !city || !state || !address) {
        return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    const branch = await Branch.create({
        name,
        city,
        state,
        address,
        manager
    });

    if (branch) {
        res.status(201).json(branch);
    } else {
        res.status(400).json({ message: 'Invalid branch data' });
    }
};

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private/Admin
const updateBranch = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);

        if (branch) {
            branch.name = req.body.name || branch.name;
            branch.city = req.body.city || branch.city;
            branch.state = req.body.state || branch.state;
            branch.address = req.body.address || branch.address;
            branch.manager = req.body.manager || branch.manager;

            const updatedBranch = await branch.save();
            res.json(updatedBranch);
        } else {
            res.status(404).json({ message: 'Branch not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getBranches, createBranch, updateBranch };
