const mongoose = require('mongoose');

const investorSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    productStatus: {
        type: String,
        enum: ['with_product', 'without_product'],
        default: 'without_product'
    },
    address: {
        type: String,
        required: true
    },
    isReferrer: {
        type: Boolean,
        default: false
    },
    upline: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Investor'
    },
    status: {
        type: String,
        enum: ['active', 'banned'],
        default: 'active'
    }
}, {
    timestamps: true
});

const Investor = mongoose.model('Investor', investorSchema);

module.exports = Investor;
