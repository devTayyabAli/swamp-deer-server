const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const crypto = require('crypto');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret_123', {
        expiresIn: '30d',
    });
};

const ResponseHelper = require('../utils/ResponseHelper');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { email, password } = req.body; // identifier can be email or userName

        console.log('=== LOGIN DEBUG ===');
        console.log('Identifier:', email);
        console.log('Password provided:', password);
        console.log('Password length:', password?.length);

        const user = await User.findOne({
            $or: [
                { email: email },
                { userName: email }
            ]
        }).populate('branchId', 'name city').populate('upline', 'name userName');


        console.log('User found:', user);
        if (user) {
            console.log('User email:', user.email);
            console.log('User userName:', user.userName);
            console.log('Password hash exists:', user.password ? 'Yes' : 'No');
            console.log('Password hash starts with:', user.password?.substring(0, 10));
            console.log('Password hash length:', user.password?.length);
        }

        if (user) {
            console.log('Attempting password match...');
            const passwordMatch = await user.matchPassword(password);
            console.log('Password match result:', passwordMatch);

            if (passwordMatch) {
                // Check if email verification is pending (only for users with token)
                if (user.isEmailVerified === false && user.emailVerificationToken) {
                    response.message = 'Please verify your email address before logging in.';
                    response.status = 403;
                    return res.status(response.status).json(response);
                }

                if (user.status === 'banned') {
                    response.message = 'Your account has been banned. Please contact admin.';
                    response.status = 403;
                    return res.status(response.status).json(response);
                }

                response.success = true;
                response.message = 'Logged in successfully';
                response.status = 200;
                response.data = {
                    _id: user._id,
                    name: user.name,
                    userName: user.userName,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    branchId: user.branchId,
                    profilePic: user.profilePic,
                    bankDetails: user.bankDetails,
                    upline: user.upline,
                    token: generateToken(user._id),
                };
            } else {
                console.log('❌ Password mismatch');
                response.message = 'Invalid credentials';
                response.status = 401;
            }
        } else {
            console.log('❌ User not found');
            response.message = 'Invalid credentials';
            response.status = 401;
        }
        console.log('=== END DEBUG ===\n');
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Login Error:', error);
        response.message = error.message || 'Server Error during login';
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

const { sendCredentials, sendVerificationEmail } = require('../utils/emailService');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        let { name, firstName, lastName, email, userName, role, branch, phone, address, upline, password } = req.body;

        // Construct name if missing but first/last provided
        if (!name && firstName && lastName) {
            name = `${firstName} ${lastName}`;
        }

        const userExists = await User.findOne({
            $or: [
                { email },
                { userName }
            ]
        });

        if (userExists) {
            response.message = `User with this ${userExists.email === email ? 'email' : 'userName'} already exists`;
            return res.status(400).json(response);
        }

        // Generate random password (8 chars) if none provided
        const finalPassword = password || Math.random().toString(36).slice(-8);

        // Resolve upline userName to ObjectId if provided
        let uplineId = null;
        if (upline) {
            const uplineUser = await User.findOne({ userName: upline });
            if (uplineUser) {
                uplineId = uplineUser._id;
            }
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const verificationToken = (password && isProduction) ? crypto.randomBytes(20).toString('hex') : null;

        let userData = {
            name,
            email,
            userName,
            password: finalPassword,
            role: role || 'investor',
            phone,
            address,
            upline: uplineId,
            isEmailVerified: !password || !isProduction // Auto-verify if created by admin or not in production
        };

        if (verificationToken) {
            // Self registration requires verification (only in production)
            userData.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
            userData.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        }

        if (branch) {
            userData.branchId = branch;
        }

        const user = await User.create(userData);

        if (user) {
            const populatedUser = await User.findById(user._id).populate('branchId', 'name city');

            // Send email based on registration type
            try {
                if (!password) {
                    await sendCredentials(user.email, finalPassword);
                } else if (verificationToken) {
                    await sendVerificationEmail(user.email, verificationToken);
                }
            } catch (emailErr) {
                console.error('Failed to send email:', emailErr);
            }

            response.success = true;
            response.message = verificationToken ? 'Registration successful. Please check your email to verify your account.' : 'Registration successful';
            response.status = 201;
            response.data = {
                _id: populatedUser._id,
                name: populatedUser.name,
                userName: populatedUser.userName,
                email: populatedUser.email,
                role: populatedUser.role,
                phone: populatedUser.phone,
                branchId: populatedUser.branchId,
                profilePic: populatedUser.profilePic,
            };

            // Generate token if verified (admin created or dev/auto-verified)
            if (!verificationToken) {
                response.data.token = generateToken(populatedUser._id);
            }
        } else {
            response.message = 'Invalid user data';
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Registration Error:', error);
        response.message = error.message || 'Server Error during registration';
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

const authAdmin = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { identifier, email, password } = req.body;
        const loginId = identifier || email;

        console.log('=== ADMIN LOGIN DEBUG ===');
        console.log('Identifier/Email:', loginId);
        console.log('Password length:', password?.length);

        const user = await User.findOne({
            $or: [
                { email: loginId },
                { userName: loginId }
            ]
        }).populate('branchId', 'name city');

        console.log('Admin found:', user ? user.email : 'No');
        if (user) console.log('Admin role:', user.role);

        if (user && (await user.matchPassword(password))) {
            if (user.role !== 'super_admin') {
                response.message = 'Not authorized as admin';
                response.status = 401;
                return res.status(response.status).json(response);
            }

            if (user.status === 'banned') {
                response.message = 'Your admin account has been suspended.';
                response.status = 403;
                return res.status(response.status).json(response);
            }

            response.success = true;
            response.message = 'Admin logged in successfully';
            response.status = 200;
            response.data = {
                _id: user._id,
                name: user.name,
                userName: user.userName,
                email: user.email,
                role: user.role,
                phone: user.phone,
                branchId: user.branchId,
                profilePic: user.profilePic,
                bankDetails: user.bankDetails,
                token: generateToken(user._id),
            };
        } else {
            response.message = 'Invalid email/userName or password';
            response.status = 401;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Admin Login Error:', error);
        response.status = 500;
        response.message = error.message;
        return res.status(response.status).json(response);
    }
};

const { sendResetPasswordEmail } = require('../utils/emailService');

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.phone = req.body.phone || user.phone;
            user.address = req.body.address || user.address;
            user.profilePic = req.body.profilePic !== undefined ? req.body.profilePic : user.profilePic;
            user.bankDetails = req.body.bankDetails || user.bankDetails;

            const updatedUser = await user.save();
            const populatedUser = await User.findById(updatedUser._id).populate('branchId', 'name city').populate('upline', 'name userName');

            response.success = true;
            response.message = 'Profile updated successfully';
            response.status = 200;
            response.data = {
                _id: populatedUser._id,
                name: populatedUser.name,
                userName: populatedUser.userName,
                email: populatedUser.email,
                role: populatedUser.role,
                phone: populatedUser.phone,
                branchId: populatedUser.branchId,
                profilePic: populatedUser.profilePic,
                bankDetails: populatedUser.bankDetails,
                upline: populatedUser.upline,
                token: generateToken(populatedUser._id),
            };
        } else {
            response.message = 'User not found';
            response.status = 404;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Update Profile Error:', error);
        response.message = error.message || 'Server Error';
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
const updateUserPassword = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            response.success = true;
            response.message = 'Password updated successfully';
            response.status = 200;
        } else {
            response.message = 'Invalid current password';
            response.status = 401;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Update Password Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            response.message = 'There is no user with that email';
            response.status = 404;
            return res.status(response.status).json(response);
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
            response.success = true;
            response.message = 'Reset password email sent';
            response.status = 200;
        } catch (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            response.message = 'Email could not be sent';
            response.status = 500;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Forgot Password Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            response.message = 'Invalid or expired token';
            return res.status(400).json(response);
        }

        // Set new password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        response.success = true;
        response.message = 'Password reset successful';
        response.status = 200;
        response.data = {
            _id: user._id,
            name: user.name,
            userName: user.userName,
            email: user.email,
            role: user.role,
            profilePic: user.profilePic,
            token: generateToken(user._id),
        };
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Reset Password Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Update user status (ban/unban)
// @route   PUT /api/auth/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.status = user.status === 'active' ? 'banned' : 'active';
            await user.save();
            response.success = true;
            response.message = `User ${user.status === 'active' ? 'unbanned' : 'banned'} successfully`;
            response.status = 200;
            response.data = { status: user.status };
        } else {
            response.message = 'User not found';
            response.status = 404;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Update Status Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Get all users with pagination and filtering
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const pageSize = Number(req.query.limit) || 10;
        const page = Number(req.query.page) || 1;
        const roles = req.query.role ? req.query.role.split(',') : [];

        const query = {};
        if (roles.length > 0) {
            query.role = { $in: roles };
        }

        if (pageSize === -1) {
            const items = await User.find(query).select('-password').sort({ name: 1 });
            response.success = true;
            response.message = 'Users retrieved successfully';
            response.status = 200;
            response.data = { items, total: items.length };
            return res.status(200).json(response);
        }

        const count = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .sort({ createdAt: -1 });

        response.success = true;
        response.message = 'Users retrieved successfully';
        response.status = 200;
        response.data = {
            items: users,
            page,
            pages: Math.ceil(count / pageSize),
            total: count
        };
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Get Users Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Update user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.userName = req.body.userName || user.userName;
            user.role = req.body.role || user.role;
            user.branchId = req.body.branchId || user.branchId;
            user.phone = req.body.phone || user.phone;
            user.address = req.body.address || user.address;
            user.productStatus = req.body.productStatus || user.productStatus;
            user.profitRate = req.body.profitRate !== undefined ? req.body.profitRate : user.profitRate;
            user.commissionRate = req.body.commissionRate !== undefined ? req.body.commissionRate : user.commissionRate;

            const updatedUser = await user.save();
            const populatedUser = await User.findById(updatedUser._id).populate('branchId', 'name city');

            response.success = true;
            response.message = 'User updated successfully';
            response.status = 200;
            response.data = {
                _id: populatedUser._id,
                name: populatedUser.name,
                userName: populatedUser.userName,
                email: populatedUser.email,
                role: populatedUser.role,
                phone: populatedUser.phone,
                branchId: populatedUser.branchId,
                bankDetails: populatedUser.bankDetails,
            };
        } else {
            response.message = 'User not found';
            response.status = 404;
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Update User Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Validate field (userName, email, phone, upline)
// @route   POST /api/auth/validate
// @access  Public
const validateField = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const { field, value } = req.body;

        if (!field || !value) {
            response.message = 'Field and value are required';
            return res.status(400).json(response);
        }

        const query = {};
        if (field === 'upline') {
            query['userName'] = value; // Search by userName for upline validation
        } else {
            query[field] = value;
        }

        // Extra validation for userName: no spaces allowed
        if (field === 'userName' && /\s/.test(value)) {
            response.message = 'Username cannot contain spaces';
            response.status = 400;
            return res.status(400).json(response);
        }

        const user = await User.findOne(query);

        if (field === 'upline') {
            // For upline, we want to know if it EXISTS
            if (user) {
                response.success = true;
                response.message = 'Referral ID is valid';
                response.status = 200;
            } else {
                response.message = 'Referral ID not found';
                response.status = 404;
            }
        } else {
            // For others (userName, email, phone), we want to know if it's AVAILABLE (doesn't exist)
            if (user) {
                response.message = `${field.charAt(0).toUpperCase() + field.slice(1)} is already taken`;
                response.status = 409; // Conflict
            } else {
                response.success = true;
                response.message = `${field.charAt(0).toUpperCase() + field.slice(1)} is available`;
                response.status = 200;
            }
        }
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Validation Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
    }
};

// @desc    Get team tree
// @route   GET /api/auth/tree/:id
// @access  Private
const getTeamTree = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Feature not implemented yet", {}, 501);
    return res.status(501).json(response);
};

const verifyEmail = async (req, res) => {
    let response = ResponseHelper.getResponse(false, "Something went wrong", {}, 400);
    try {
        const verificationToken = req.params.token;
        if (!verificationToken) {
            response.message = 'Token is required';
            return res.status(400).json(response);
        }

        // Hash token to compare
        const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            response.message = 'Invalid or expired verification token';
            return res.status(400).json(response);
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        response.success = true;
        response.message = 'Email verified successfully';
        response.status = 200;
        response.data = {
            verified: true,
            email: user.email
        };
        return res.status(response.status).json(response);
    } catch (error) {
        console.error('Verify Email Error:', error);
        response.message = error.message;
        response.status = 500;
        return res.status(response.status).json(response);
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
    updateUser,
    validateField,
    getTeamTree,
    verifyEmail,
};
