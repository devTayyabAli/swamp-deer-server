const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models (assuming standard relative paths in api structure)
// We might need to define them here if require fails during standalone run
const User = require('./models/User');
const Sale = require('./models/Sale');
const Investor = require('./models/Investor');

dotenv.config({ path: path.join(__dirname, '.env') });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sales_management');
        console.log('MongoDB Connected for Migration...');

        const investors = await Investor.find({});
        console.log(`Found ${investors.length} legacy investors to migrate.`);

        const idMapping = {}; // Old Investor ID -> New User ID

        for (const inv of investors) {
            const email = inv.email || `${inv.phone}@partner.cli`;
            console.log(`Migrating: ${inv.fullName} (${email})`);
            
            // Check if user already exists
            let user = await User.findOne({ email });
            
            if (!user) {
                user = await User.create({
                    name: inv.fullName,
                    email,
                    phone: inv.phone,
                    address: inv.address,
                    role: inv.isReferrer ? 'referrer' : 'investor',
                    productStatus: inv.productStatus || 'without_product',
                    status: inv.status || 'active',
                    password: 'password123', // Default password for migrated users
                });
                console.log(`Created new User record for ${inv.fullName}`);
            } else {
                console.log(`User record already exists for ${inv.email}, updating role/phone if needed.`);
                user.role = inv.isReferrer ? 'referrer' : 'investor';
                user.phone = inv.phone;
                user.address = inv.address;
                user.productStatus = inv.productStatus || 'without_product';
                await user.save();
            }

            idMapping[inv._id.toString()] = user._id;
        }

        // Update Uplines (now that all users are created)
        console.log('Updating upline references...');
        for (const inv of investors) {
            if (inv.upline) {
                const newUser = await User.findById(idMapping[inv._id.toString()]);
                const newUplineId = idMapping[inv.upline.toString()];
                if (newUser && newUplineId) {
                    newUser.upline = newUplineId;
                    await newUser.save();
                }
            }
        }

        // Update Sales
        console.log('Updating sales references...');
        const sales = await Sale.find({ 
            $or: [
                { investorId: { $in: Object.keys(idMapping) } },
                { referrerId: { $in: Object.keys(idMapping) } }
            ] 
        });

        console.log(`Found ${sales.length} sales to update.`);

        for (const sale of sales) {
            let updated = false;
            
            // Link to new IDs
            if (sale.investorId && idMapping[sale.investorId.toString()]) {
                sale.investorId = idMapping[sale.investorId.toString()];
                updated = true;
            }
            if (sale.referrerId && idMapping[sale.referrerId.toString()]) {
                sale.referrerId = idMapping[sale.referrerId.toString()];
                updated = true;
            }

            // Fill missing required fields for legacy sales
            if (!sale.paymentMethod) {
                sale.paymentMethod = 'Cash in hand';
                updated = true;
            }
            if (sale.investorProfit === undefined) {
                sale.investorProfit = sale.amount * 0.1; // Default 10%
                updated = true;
            }

            if (updated) {
                await sale.save();
            }
        }

        console.log('Migration completed successfully!');
        process.exit();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
