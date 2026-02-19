const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    userName: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'branch_manager', 'sales_rep', 'investor', 'referrer'],
        default: 'investor'
    },
    phone: {
        type: String,
        unique: true,
        sparse: true // Allow null for accounts without phone initially
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true

    },
    userRankId: {
        type: Number,
        default: null
    },
    totalSelfBusiness: {
        type: Number,
        default: 0
    },
    totalDirectBusiness: {
        type: Number,
        default: 0
    },
    totalTeamBusiness: {
        type: Number,
        default: 0
    },
    totalTeamSize: {
        type: Number,
        default: 0
    },
    currentLevel: {
        type: Number,
        default: 0
    },
    address: String,
    upline: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },
    status: {
        type: String,
        enum: ['active', 'banned'],
        default: 'active'
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        branchName: String,
        accountHolderName: String
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    profilePic: String
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Mongoose 5.x+ supports async functions without next callback
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
