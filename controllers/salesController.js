const Sale = require('../models/Sale');
const User = require('../models/User');
const { generateInvestmentDocument } = require('../utils/pdfGenerator');

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { branchId, startDate, endDate, status } = req.query;

    const query = {};
    
    // Role-based filtering
    if (req.user.role === 'super_admin') {
        if (branchId && !['all branches', 'undefined', 'null'].includes(branchId.toLowerCase())) {
            query.branchId = branchId;
        }
    } else if (req.user.role === 'branch_manager') {
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
    } else if (req.user.role === 'sales_rep') {
        query.user = req.user._id;
    } else if (req.user.role === 'investor') {
        query.investorId = req.user._id;
    } else if (req.user.role === 'referrer') {
        query.referrerId = req.user._id;
    }

    if (status && !['all', 'undefined', 'null'].includes(status.toLowerCase())) {
        query.status = status.toLowerCase();
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    const count = await Sale.countDocuments(query);
    
    // If admin, show all. If user, show only theirs (logic can be extended)
    const sales = await Sale.find(query)
        .populate('user', 'id name')
        .populate('branchId', 'name')
        .populate('investorId', 'name')
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 }); // Sort by newest first

    // Map name to fullName for frontend compatibility
    const mappedSales = sales.map(sale => {
        const s = sale.toObject();
        if (s.investorId && s.investorId.name) {
            s.investorId.fullName = s.investorId.name;
        }
        return s;
    });

    res.json({
        items: mappedSales,
        page,
        pages: Math.ceil(count / limit),
        total: count
    });
};

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res) => {
    const { branch, investor, referrer, customerName, description, amount, commission, investorProfit, paymentMethod } = req.body;

    if (!branch || !investor || !customerName || !description || !amount || investorProfit === undefined || !paymentMethod) {
        return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    const sale = await Sale.create({
        user: req.user._id,
        branchId: branch,
        investorId: investor,
        referrerId: referrer || null,
        customerName,
        description,
        amount,
        commission,
        investorProfit,
        paymentMethod
    });

    if (sale) {
        // Generate PDF Document
        try {
            const investorData = await User.findById(investor);
            if (investorData) {
                // Map name to fullName for PDF generator compatibility if needed
                const pdftData = {
                    ...investorData.toObject(),
                    fullName: investorData.name
                };
                const pdfPath = await generateInvestmentDocument(sale, pdftData);
                console.log(`Document generated at: ${pdfPath}`);
                // Store as relative URL for the frontend
                const relativePath = `uploads/documents/investment_${sale._id}.pdf`;
                sale.documentPath = relativePath;
                await sale.save();
            }
        } catch (pdfError) {
            console.error('Error generating investment document:', pdfError);
            // We don't fail the sale creation if PDF fails, but we log it
        }

        res.status(201).json(sale);
    } else {
        res.status(400).json({ message: 'Invalid sale data' });
    }
};

// @desc    Update sale status
// @route   PUT /api/sales/:id/status
// @access  Private/Admin
const updateSaleStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['pending', 'completed', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const sale = await Sale.findById(req.params.id);

        if (sale) {
            sale.status = status;
            const updatedSale = await sale.save();
            res.json(updatedSale);
        } else {
            res.status(404).json({ message: 'Sale not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSales, createSale, updateSaleStatus };
