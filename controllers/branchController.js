const Branch = require('../models/Branch');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public (or Private)
const getBranches = async (req, res) => {
    try {
        const branches = await Branch.aggregate([
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'branchId',
                    as: 'sales'
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
                    linkedInvestorsCount: { $size: { $setUnion: { $ifNull: ['$sales.investorId', []] } } }
                }
            },
            {
                $project: {
                    sales: 0,
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
