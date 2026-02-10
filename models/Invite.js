const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    email: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['pending', 'used', 'expired'],
        default: 'pending',
    },
},
    { timestamps: true },
);

const Invite = mongoose.model('Invite', inviteSchema);

module.exports = Invite;
