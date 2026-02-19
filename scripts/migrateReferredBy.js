const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = '69961198d98a549c18389d11'; // Super Admin Account

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully.');

        // Find users missing referredBy
        const usersToUpdate = await User.find({
            $or: [
                { referredBy: { $exists: false } },
                { referredBy: null }
            ]
        });

        console.log(`Found ${usersToUpdate.length} users requiring referredBy update.`);

        let updatedCount = 0;
        for (const user of usersToUpdate) {
            // Priority: existing upline field, then fallback to Super Admin
            const referralId = user.upline || ADMIN_ID;

            // If the user's ID is the same as the referralId (edge case for Admin), 
            // and it's the Admin user itself, we might want to skip or handle specially.
            // But usually Admin doesn't have referredBy or points to itself.
            // For now, satisfy the requirement.

            user.referredBy = referralId;

            // Use updateOne to avoid validation logic that might trigger errors on other fields
            await User.updateOne({ _id: user._id }, { $set: { referredBy: referralId } });
            updatedCount++;

            if (updatedCount % 50 === 0) {
                console.log(`Progress: ${updatedCount} users updated...`);
            }
        }

        console.log(`Successfully migrated ${updatedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
