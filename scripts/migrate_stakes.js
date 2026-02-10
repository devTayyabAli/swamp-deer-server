const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Sale = require('../models/Sale');
const UserStakeReward = require('../models/UserStakingReward');
const connectDB = require('../config/db');
const { INVESTMENT_CONSTANTS, PRODUCT_STATUS } = require('../config/investmentPlans');

dotenv.config();

/**
 * Migration: Consolidate legacy Stake data into Sale collection
 */
const migrateStakes = async () => {
    try {
        await connectDB();
        console.log('Connected to MongoDB for consolidation...');

        // Access the legacy 'stakes' collection directly since Stake model is deleted
        const db = mongoose.connection.db;
        const legacyStakes = await db.collection('stakes').find({}).toArray();

        console.log(`Found ${legacyStakes.length} legacy stakes to migrate.`);

        for (const stake of legacyStakes) {
            console.log(`Processing legacy stake ${stake._id} for user ${stake.userId}...`);

            // Find the corresponding Sale record
            // Matching by investorId and amount is safest
            const sale = await Sale.findOne({
                investorId: stake.userId,
                amount: stake.amount,
                status: { $in: ['completed', 'active', 'pending'] }
            }).sort({ createdAt: -1 });

            if (sale) {
                console.log(`Matching Sale found: ${sale._id}. Migrating data...`);

                // Update Sale with Stake's tracking data
                sale.status = stake.status || 'active';
                sale.duration = stake.duration || INVESTMENT_CONSTANTS.TOTAL_DURATION_DAYS;
                sale.rewardPercentage = stake.rewardPercentage;
                sale.endDate = stake.endDate;
                sale.lastRewardAt = stake.lastRewardAt;
                sale.productStatus = stake.productStatus || sale.productStatus;
                sale.currentPhase = stake.currentPhase || 1;
                sale.phaseStartDate = stake.phaseStartDate || stake.createdAt;
                sale.monthsCompleted = stake.monthsCompleted || 0;
                sale.totalProfitEarned = stake.totalProfitEarned || 0;
                sale.profitCap = stake.profitCap || (stake.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER);

                await sale.save();

                // Update reward records to point to the Sale ID instead of the old Stake ID
                const rewardUpdate = await UserStakeReward.updateMany(
                    { stakeId: stake._id },
                    { $set: { stakeId: sale._id } }
                );
                console.log(`Updated ${rewardUpdate.modifiedCount} reward records for this investment.`);

            } else {
                console.warn(`WARNING: No matching Sale found for stake ${stake._id}. Creating fallback Sale record...`);
                // Fallback: create a sale record so the investment data isn't lost
                await Sale.create({
                    user: stake.userId,
                    branchId: new mongoose.Types.ObjectId(), // Placeholder - needs actual branch if known
                    investorId: stake.userId,
                    customerName: "Migrated Investment",
                    description: "Auto-migrated from legacy Stake collection",
                    amount: stake.amount,
                    commission: 0,
                    investorProfit: 0,
                    paymentMethod: "Cash in hand",
                    status: stake.status || 'active',
                    productStatus: stake.productStatus || 'without_product',
                    duration: stake.duration || INVESTMENT_CONSTANTS.TOTAL_DURATION_DAYS,
                    rewardPercentage: stake.rewardPercentage,
                    endDate: stake.endDate,
                    lastRewardAt: stake.lastRewardAt,
                    currentPhase: stake.currentPhase || 1,
                    phaseStartDate: stake.phaseStartDate || stake.createdAt,
                    monthsCompleted: stake.monthsCompleted || 0,
                    totalProfitEarned: stake.totalProfitEarned || 0,
                    profitCap: stake.profitCap || (stake.amount * INVESTMENT_CONSTANTS.PROFIT_CAP_MULTIPLIER)
                });
            }
        }

        console.log('Consolidation completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateStakes();
