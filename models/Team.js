const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: false
    }
},
    { timestamps: true },
);

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
