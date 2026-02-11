const Sale = require('../models/Sale');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendCredentials } = require('../utils/emailService');

const getInvestors = async (req, res) => {
    try {
        const pageSize = Number(req.query.limit) || 10;
        const page = Number(req.query.page) || 1;
        const isReferrer = req.query.isReferrer;

        const match = { role: { $in: ['investor', 'referrer', 'sales_rep'] } };
        if (isReferrer !== undefined) {
            match.role = isReferrer === 'true' ? 'referrer' : { $in: ['investor', 'sales_rep'] };
        }

        const { startDate, endDate, search } = req.query;

        if (search) {
            match.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                match.createdAt.$lte = end;
            }
        }

        const aggregation = [
            { $match: match },
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'investorId',
                    as: 'investments'
                }
            },
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'salesMade'
                }
            },
            {
                $addFields: {
                    fullName: '$name',
                    amountInvested: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$investments',
                                        as: 's',
                                        cond: { $in: ['$$s.status', ['completed', 'active']] }
                                    }
                                },
                                as: 'sale',
                                in: '$$sale.amount'
                            }
                        }
                    },
                    totalReward: {
                        $add: [
                            {
                                $sum: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: '$investments',
                                                as: 's',
                                                cond: { $in: ['$$s.status', ['completed', 'active']] }
                                            }
                                        },
                                        as: 'sale',
                                        in: { $ifNull: ['$$sale.investorProfit', { $multiply: ['$$sale.amount', 0.1] }] }
                                    }
                                }
                            },
                            {
                                $sum: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: '$salesMade',
                                                as: 's',
                                                cond: { $in: ['$$s.status', ['completed', 'active']] }
                                            }
                                        },
                                        as: 'sale',
                                        in: { $ifNull: ['$$sale.commission', 0] }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            { $project: { investments: 0, password: 0 } },
            { $sort: { createdAt: -1 } }
        ];

        const totalsAggregation = [
            { $match: match },
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'investorId',
                    as: 'investments'
                }
            },
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'salesMade'
                }
            },
            {
                $addFields: {
                    investorTotalAmt: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$investments',
                                        as: 's',
                                        cond: { $in: ['$$s.status', ['completed', 'active']] }
                                    }
                                },
                                as: 'sale',
                                in: '$$sale.amount'
                            }
                        }
                    },
                    investorTotalReward: {
                        $add: [
                            {
                                $sum: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: '$investments',
                                                as: 's',
                                                cond: { $in: ['$$s.status', ['completed', 'active']] }
                                            }
                                        },
                                        as: 'sale',
                                        in: { $ifNull: ['$$sale.investorProfit', { $multiply: ['$$sale.amount', 0.1] }] }
                                    }
                                }
                            },
                            {
                                $sum: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: '$salesMade',
                                                as: 's',
                                                cond: { $in: ['$$s.status', ['completed', 'active']] }
                                            }
                                        },
                                        as: 'sale',
                                        in: { $ifNull: ['$$sale.commission', 0] }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmountInvested: { $sum: '$investorTotalAmt' },
                    totalRewardPaid: { $sum: '$investorTotalReward' },
                    totalInvestors: { $sum: 1 }
                }
            }
        ];

        const totalsResult = await User.aggregate(totalsAggregation);
        const totals = totalsResult.length > 0 ? totalsResult[0] : { totalAmountInvested: 0, totalRewardPaid: 0, totalInvestors: 0 };

        if (pageSize === -1) {
            const results = await User.aggregate(aggregation);
            // Manually populate upline after aggregation because $lookup with ref is complex
            const populatedResults = await User.populate(results, { path: 'upline', select: 'name phone' });
            res.json({
                items: populatedResults.map(r => ({ ...r, fullName: r.name })),
                total: populatedResults.length,
                totalAmountInvested: totals.totalAmountInvested,
                totalRewardPaid: totals.totalRewardPaid
            });
            return;
        }

        const countAggregation = [...aggregation, { $count: 'total' }];
        const countResult = await User.aggregate(countAggregation);
        const count = countResult.length > 0 ? countResult[0].total : 0;

        const paginatedAggregation = [
            ...aggregation,
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
        ];

        const investors = await User.aggregate(paginatedAggregation);
        const populatedInvestors = await User.populate(investors, { path: 'upline', select: 'name phone' });

        res.json({
            items: populatedInvestors.map(r => ({ ...r, fullName: r.name })),
            page,
            pages: Math.ceil(count / pageSize),
            total: count,
            totalAmountInvested: totals.totalAmountInvested,
            totalRewardPaid: totals.totalRewardPaid
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update investor status (ban/unban)
// @route   PUT /api/investors/:id/status
// @access  Private/Admin
const updateInvestorStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.status = user.status === 'active' ? 'banned' : 'active';
            await user.save();
            res.json({ message: `Partner ${user.status === 'active' ? 'unbanned' : 'banned'} successfully`, status: user.status });
        } else {
            res.status(404).json({ message: 'Partner not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new investor/referrer
// @route   POST /api/investors
// @access  Private
const createInvestor = async (req, res) => {
    const { fullName, email, phone, address, isReferrer, upline, productStatus } = req.body;

    if (!fullName || !email || !phone || !address) {
        return res.status(400).json({ message: 'Please fill in all fields' });
    }

    const userExists = await User.findOne({ $or: [{ phone }, { email }] });
    if (userExists) {
        return res.status(400).json({ message: 'Phone number or email already registered' });
    }

    // Generate random password (8 chars) if none provided
    const generatedPassword = Math.random().toString(36).slice(-8);

    const user = await User.create({
        name: fullName,
        email,
        password: generatedPassword,
        phone,
        address,
        role: isReferrer ? 'referrer' : 'investor',
        upline: upline || null,
        productStatus: productStatus || 'without_product'
    });

    if (user && upline) {
        // Automatically promote upline to referrer status if they were just an investor
        const uplineUser = await User.findById(upline);
        if (uplineUser && uplineUser.role === 'investor') {
            uplineUser.role = 'referrer';
            await uplineUser.save();
        }
    }

    if (user) {
        // Send email with credentials
        await sendCredentials(user.email, generatedPassword);

        res.status(201).json({ ...user.toObject(), fullName: user.name });
    } else {
        res.status(400).json({ message: 'Invalid entity data' });
    }
};

const UserStakeReward = require('../models/UserStakingReward');

// ... (existing code)

// @desc    Get investor team (upline and downline) with sales stats
// @route   GET /api/investors/:id/team
// @access  Private
const getInvestorTeam = async (req, res) => {
    try {
        const id = req.params.id && req.params.id !== 'me' ? req.params.id : req.user._id;
        const user = await User.findById(id).populate('upline', 'name phone');
        if (!user) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        // Find all direct downline (users who have this partner as their upline)
        const directDownline = await User.find({ upline: id }).sort({ createdAt: 1 });

        // Find all indirect downline (recursively get downline of downline)
        const getIndirectDownline = async (userId) => {
            const directChildren = await User.find({ upline: userId });
            let allIndirect = [];

            for (const child of directChildren) {
                const childrenOfChild = await getIndirectDownline(child._id);
                allIndirect = allIndirect.concat(childrenOfChild);
            }

            return allIndirect.concat(directChildren);
        };

        let indirectDownline = [];
        for (const directMember of directDownline) {
            const indirectMembers = await getIndirectDownline(directMember._id);
            indirectDownline = indirectDownline.concat(indirectMembers);
        }

        // Remove duplicates from indirect (keep only truly indirect)
        const directIds = new Set(directDownline.map(d => d._id.toString()));
        indirectDownline = indirectDownline.filter(member => !directIds.has(member._id.toString()));

        const allTeamIds = [id, ...directDownline.map(d => d._id), ...indirectDownline.map(d => d._id)];

        // Aggregate total investment amount per user
        const salesAggregation = await Sale.aggregate([
            {
                $match: {
                    user: { $in: allTeamIds },
                    status: { $in: ['completed', 'active'] }
                }
            },
            {
                $group: {
                    _id: '$user',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Aggregate ACTUAL earnings from team (level/direct income)
        const earningsAggregation = await UserStakeReward.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(id), // Rewards received by ME (or the viewed user)
                    type: { $in: ['level_income', 'direct_income'] }
                }
            },
            {
                $lookup: {
                    from: 'sales',
                    localField: 'stakeId',
                    foreignField: '_id',
                    as: 'stake'
                }
            },
            { $unwind: '$stake' },
            {
                $match: {
                    'stake.user': { $in: allTeamIds } // Only rewards from my team found above
                }
            },
            {
                $group: {
                    _id: '$stake.user', // Group by the downline member who generated this income
                    totalEarned: { $sum: '$amount' }
                }
            }
        ]);

        // Create maps for quick lookup
        const salesMap = new Map();
        salesAggregation.forEach(stat => {
            salesMap.set(stat._id.toString(), stat.totalAmount);
        });

        const earningsMap = new Map(); // Map: DownlineUserID -> EarningsFromThem
        earningsAggregation.forEach(stat => {
            earningsMap.set(stat._id.toString(), stat.totalEarned);
        });

        // Format direct team members
        const formattedDirect = directDownline.map(member => {
            return {
                _id: member._id,
                name: member.name,
                fullName: member.name,
                email: member.email,
                phone: member.phone,
                role: member.role,
                amount: salesMap.get(member._id.toString()) || 0,
                profit: earningsMap.get(member._id.toString()) || 0, // CORRECTED: Now shows earnings from them
                date: member.createdAt,
                upline: user.name,
                type: 'direct'
            };
        });

        // Format indirect team members
        const formattedIndirect = indirectDownline.map(member => {
            return {
                _id: member._id,
                name: member.name,
                fullName: member.name,
                email: member.email,
                phone: member.phone,
                role: member.role,
                amount: salesMap.get(member._id.toString()) || 0,
                profit: earningsMap.get(member._id.toString()) || 0, // CORRECTED: Now shows earnings from them
                date: member.createdAt,
                upline: 'N/A',
                type: 'indirect'
            };
        });

        res.json({
            upline: user.upline ? {
                _id: user.upline._id,
                name: user.upline.name,
                fullName: user.upline.name,
                phone: user.upline.phone
            } : null,
            current: {
                _id: user._id,
                name: user.name,
                fullName: user.name,
                phone: user.phone,
                role: user.role,
                amountInvested: salesMap.get(user._id.toString())?.amount || 0,
                totalReward: salesMap.get(user._id.toString())?.profit || 0
            },
            direct: formattedDirect,
            indirect: formattedIndirect,
            all: [...formattedDirect, ...formattedIndirect]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current partner profile with investment stats
// @route   GET /api/investors/profile
// @access  Private
const getPartnerProfileWithStats = async (req, res) => {
    try {
        const results = await User.aggregate([
            { $match: { _id: req.user._id } },
            {
                $lookup: {
                    from: 'sales',
                    localField: '_id',
                    foreignField: 'investorId',
                    as: 'investments'
                }
            },
            {
                $addFields: {
                    amountInvested: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$investments',
                                        as: 's',
                                        cond: { $in: ['$$s.status', ['completed', 'active']] }
                                    }
                                },
                                as: 'sale',
                                in: '$$sale.amount'
                            }
                        }
                    },
                    totalReward: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$investments',
                                        as: 's',
                                        cond: { $in: ['$$s.status', ['completed', 'active']] }
                                    }
                                },
                                as: 'sale',
                                in: { $ifNull: ['$$sale.investorProfit', { $multiply: ['$$sale.amount', 0.1] }] }
                            }
                        }
                    }
                }
            },
            { $project: { investments: 0, password: 0 } }
        ]);

        if (results.length > 0) {
            const partner = await User.populate(results[0], { path: 'upline', select: 'name phone' });
            res.json({ ...partner, fullName: partner.name });
        } else {
            res.status(404).json({ message: 'Partner not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getInvestors, createInvestor, updateInvestorStatus, getInvestorTeam, getPartnerProfileWithStats };
