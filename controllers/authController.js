const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret_123', {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('branchId', 'name city');

    if (user && (await user.matchPassword(password))) {
        if (user.status === 'banned') {
            res.status(403).json({ message: 'Your account has been banned. Please contact admin.' });
            return;
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            branchId: user.branchId,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

const { sendCredentials } = require('../utils/emailService');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (or Admin only depending on logic)
const registerUser = async (req, res) => {
    try {
        let { name, firstName, lastName, email, role, branch, phone, address, upline, productStatus } = req.body;

        // Construct name if missing but first/last provided
        if (!name && firstName && lastName) {
            name = `${firstName} ${lastName}`;
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate random password (8 chars) if none provided
        const generatedPassword = req.body.password || Math.random().toString(36).slice(-8);

        const userData = {
            name,
            email,
            password: generatedPassword,
            role: role || 'sales_rep',
            phone,
            address,
            upline,
            productStatus: productStatus || 'without_product'
        };

        if (branch) {
            userData.branchId = branch;
        }

        const user = await User.create(userData);

        if (user) {
            // Send email with credentials (only if generated)
            if (!req.body.password) {
                await sendCredentials(user.email, generatedPassword);
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                branchId: user.branchId,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: error.message || 'Server Error during registration' });
    }
};

const authAdmin = async (req, res) => {
    const { email, password } = req.body;

    // Hardcoded Admin Check (Temporary)
    if (email === 'tayyabarine@gmail.com' && password === '1234') {
         return res.json({
            _id: '5f8d0d55b54764421b7156c9', // Valid 24-char hex ObjectId
            name: 'Hardcoded Admin',
            email: 'tayyabarine@gmail.com',
            role: 'super_admin',
            token: generateToken('5f8d0d55b54764421b7156c9'),
        });
    }

    const user = await User.findOne({ email }).populate('branchId', 'name city');

    if (user && (await user.matchPassword(password))) {
        if (user.role !== 'super_admin') {
            res.status(401).json({ message: 'Not authorized as admin' });
            return;
        }

        if (user.status === 'banned') {
            res.status(403).json({ message: 'Your admin account has been suspended.' });
            return;
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            branchId: user.branchId,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

const crypto = require('crypto');
const { sendResetPasswordEmail } = require('../utils/emailService');

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            const updatedUser = await user.save();
            const populatedUser = await User.findById(updatedUser._id).populate('branchId', 'name city');

            res.json({
                _id: populatedUser._id,
                name: populatedUser.name,
                email: populatedUser.email,
                role: populatedUser.role,
                phone: populatedUser.phone,
                branchId: populatedUser.branchId,
                token: generateToken(populatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: error.message || 'Server Error' });
    }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
const updateUserPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (user && (await user.matchPassword(currentPassword))) {
        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } else {
        res.status(401).json({ message: 'Invalid current password' });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Set reset token and expiry
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Create reset url
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    try {
        await sendResetPasswordEmail(user.email, resetUrl);
        res.status(200).json({ message: 'Email sent' });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(500).json({ message: 'Email could not be sent' });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
    });
};

// @desc    Update user status (ban/unban)
// @route   PUT /api/auth/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.status = user.status === 'active' ? 'banned' : 'active';
            await user.save();
            res.json({ message: `User ${user.status === 'active' ? 'unbanned' : 'banned'} successfully`, status: user.status });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users with pagination and filtering
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    const pageSize = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const roles = req.query.role ? req.query.role.split(',') : [];

    const query = {};
    if (roles.length > 0) {
        query.role = { $in: roles };
    }

    if (pageSize === -1) {
        const items = await User.find(query).select('-password').sort({ name: 1 });
        res.json({ items, total: items.length });
        return;
    }

    const count = await User.countDocuments(query);
    const users = await User.find(query)
        .select('-password')
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .sort({ createdAt: -1 });

    res.json({
        items: users,
        page,
        pages: Math.ceil(count / pageSize),
        total: count
    });
};

// @desc    Update user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;
            user.branchId = req.body.branchId || user.branchId;

            const updatedUser = await user.save();
            const populatedUser = await User.findById(updatedUser._id).populate('branchId', 'name city');

            res.json({
                _id: populatedUser._id,
                name: populatedUser.name,
                email: populatedUser.email,
                role: populatedUser.role,
                phone: populatedUser.phone,
                branchId: populatedUser.branchId,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    authUser, 
    registerUser, 
    authAdmin, 
    getUsers, 
    updateUserProfile, 
    updateUserPassword, 
    forgotPassword, 
    resetPassword,
    updateUserStatus,
    updateUser
};
