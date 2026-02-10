const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const adminExists = await User.findOne({ email: 'admin@swampdeer.com' });

        if (adminExists) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        const adminUser = await User.create({
            name: 'Super Admin',
            userName: 'admin',
            email: 'admin@swampdeer.com',
            password: 'AdminPassword123',
            role: 'super_admin',
            status: 'active'
        });

        if (adminUser) {
            console.log('Super Admin user created successfully!');
            console.log('Email: admin@swampdeer.com');
            console.log('Username: admin');
            console.log('Password: AdminPassword123');
        } else {
            console.log('Failed to create admin user');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin();
