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
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'branch_manager', 'sales_rep', 'investor', 'referrer'],
        default: 'sales_rep'
    },
    phone: {
        type: String,
        unique: true,
        sparse: true // Allow null for accounts without phone initially
    },
    address: String,
    upline: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    productStatus: {
        type: String,
        enum: ['with_product', 'without_product'],
        default: 'without_product'
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
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
