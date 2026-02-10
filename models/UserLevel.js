const mongoose = require('mongoose');

const userLevelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    level: {
        type: Number,
        required: true,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
},
    { timestamps: true },
);

const UserLevel = mongoose.model('UserLevel', userLevelSchema);

module.exports = UserLevel;
