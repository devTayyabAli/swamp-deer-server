const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedUpline = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/swamp-deer');
        console.log('Connected to MongoDB');

        const userName = 'upline_test';
        const existingUser = await User.findOne({ userName });

        if (existingUser) {
            console.log(`User with userName "${userName}" already exists.`);
            process.exit(0);
        }

        const uplineUser = await User.create({
            name: 'Test Upline',
            userName: userName,
            email: 'upline@example.com',
            password: 'password123',
            role: 'sales_rep',
            phone: '1234567890',
            status: 'active'
        });

        console.log('Upline user created successfully:', uplineUser.userName);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding upline user:', error);
        process.exit(1);
    }
};

seedUpline();
