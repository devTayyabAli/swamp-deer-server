const express = require('express');
const router = express.Router();
const {
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
    getTeamTree,
    validateField,
    verifyEmail
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', authUser);
router.put('/verifyemail/:token', verifyEmail);
router.post('/validate', validateField);
router.post('/admin-login', authAdmin);
router.get('/users', protect, admin, getUsers);
router.put('/users/:id/status', protect, admin, updateUserStatus);
router.put('/users/:id', protect, admin, updateUser);
router.put('/profile', protect, updateUserProfile);
router.put('/password', protect, updateUserPassword);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/tree', protect, getTeamTree);
router.get('/tree/:id', protect, getTeamTree);

module.exports = router;
