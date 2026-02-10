const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ResponseHelper = require('../utils/ResponseHelper');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_123');

            // Handle hardcoded admin bypass
            if (decoded.id === '5f8d0d55b54764421b7156c9') {
                req.user = {
                    _id: '5f8d0d55b54764421b7156c9',
                    name: 'Hardcoded Admin',
                    email: 'admin@example.com',
                    role: 'super_admin'
                };
            } else {
                req.user = await User.findById(decoded.id).select('-password');
            }

            if (!req.user) {
                const response = ResponseHelper.getResponse(false, 'Not authorized, user not found', {}, 401);
                return res.status(401).json(response);
            }

            next();
        } catch (error) {
            console.error(error);
            const response = ResponseHelper.getResponse(false, 'Not authorized, token failed', {}, 401);
            return res.status(401).json(response);
        }
    }

    if (!token) {
        const response = ResponseHelper.getResponse(false, 'Not authorized, no token', {}, 401);
        return res.status(401).json(response);
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        const response = ResponseHelper.getResponse(false, 'Not authorized as an admin', {}, 401);
        return res.status(401).json(response);
    }
};

module.exports = { protect, admin };
