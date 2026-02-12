const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const Sale = require('./models/Sale');
const UserStakeReward = require('./models/UserStakingReward');
const InvestmentPlan = require('./models/InvestmentPlan');
const { processCompletedSale } = require('./services/stakeService');
const { distributeMonthlyRewards } = require('./cron/rewardCron');
const initializeGlobalPlan = require('./utils/initializePlan');

dotenv.config();

const runTest = async () => {
    try {
        await connectDB();
        console.log('--- SYSTEM TEST START ---');

        // 1. Ensure Global Plan is Initialized
        await initializeGlobalPlan();
        const config = await InvestmentPlan.findOne({ scope: 'global' });
        console.log('Global Config Found:', !!config);

        // 2. Setup Data
        console.log('Cleaning old test data...');
        await User.deleteMany({ userName: /^testuser/ });
        await Sale.deleteMany({ customerName: /Test/i });
        await UserStakeReward.deleteMany({ description: /Test/i });
        const Branch = require('./models/Branch');
        await Branch.deleteMany({ name: 'Test Branch' });

        const testBranch = await Branch.create({
            name: 'Test Branch',
            city: 'Test City',
            state: 'Test State',
            address: '123 Test St'
        });

        // Setup User Chain (9 Levels)
        console.log('Setting up user chain (9 users)...');
        const users = [];
        let prevUser = null;

        // User Chain: testuser0 (top) -> testuser1 -> ... -> testuser8 (investor)
        for (let i = 0; i < 9; i++) {
            const userName = `testuser${i}`;
            const user = await User.create({
                name: `Test User ${i}`,
                userName,
                email: `${userName}@example.com`,
                password: 'password123',
                upline: prevUser ? prevUser._id : null,
                status: 'active'
            });
            users[i] = user;
            prevUser = user;
        }

        const salesRep = users[7]; // testuser7 (direct referrer of testuser8)
        const investor = users[8]; // testuser8 

        console.log(`Investor: ${investor.userName}, Sales Rep: ${salesRep.userName}`);

        // 3. Create a Sale
        console.log('Creating test sale (1,000,000 PKR)...');
        const sale = await Sale.create({
            user: salesRep._id,
            investorId: investor._id,
            customerName: 'Test Investor',
            amount: 1000000,
            commission: 100, // Dummy
            branchId: testBranch._id,
            status: 'completed',
            productStatus: 'without_product',
            paymentMethod: 'Cash in hand',
            transactionId: 'TXN123',
            paymentProof: 'proof.jpg'
        });

        // 4. Process Sale (Triggers Direct Bonuses and Rank Checks)
        console.log('Processing completed sale...');
        await processCompletedSale(sale._id);

        // 5. Verify Direct Bonuses (Should be 8 levels)
        const directRewards = await UserStakeReward.find({ stakeId: sale._id, type: 'direct_income' }).sort({ createdAt: 1 });
        console.log(`Direct Bonuses Distributed: ${directRewards.length}/8`);

        directRewards.forEach((r, idx) => {
            const expectedRate = config.referralBonusRates[idx];
            const expectedAmount = sale.amount * expectedRate;
            console.log(`  Level ${idx + 1}: Expected ${expectedAmount}, Got ${r.amount} (${r.amount === expectedAmount ? 'PASS' : 'FAIL'})`);
        });

        // 6. Verify Business Volume & Rank Upgrades
        const upline0 = await User.findById(users[0]._id);
        console.log(`Upline 0 (Top) Team Business: ${upline0.totalTeamBusiness}`);
        // Rank 1 target is 1,500,000 for without_product. 1,000,000 isn't enough.
        // Let's create another sale to trigger Rank 1.

        console.log('Creating second sale to trigger rank upgrade...');
        const sale2 = await Sale.create({
            user: salesRep._id,
            investorId: investor._id,
            customerName: 'Test Investor 2',
            amount: 1000000,
            commission: 100,
            branchId: testBranch._id,
            status: 'completed',
            productStatus: 'without_product',
            paymentMethod: 'Cash in hand',
            transactionId: 'TXN124',
            paymentProof: 'proof2.jpg'
        });
        await processCompletedSale(sale2._id);

        const upline0After = await User.findById(users[0]._id);
        console.log(`Upline 0 Rank: ${upline0After.userRankId} (Exp: 1) -> ${upline0After.userRankId === 1 ? 'PASS' : 'FAIL'}`);

        // 7. Test Cron Job (ROI & Matching Bonuses)
        console.log('Simulating Cron Job (ROI Distribution)...');
        // Force investment to be due by changing lastRewardAt
        const activeInvestment = await Sale.findById(sale._id);
        activeInvestment.status = 'active';
        activeInvestment.lastRewardAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
        await activeInvestment.save();

        process.env.NODE_ENV = 'production'; // Ensure 30 day maturity logic
        await distributeMonthlyRewards();

        // 8. Verify ROI and Matching Bonuses
        const roiReward = await UserStakeReward.findOne({ stakeId: sale._id, type: 'staking' });
        console.log('ROI Reward Found:', !!roiReward);
        if (roiReward) {
            const currentPhase = activeInvestment.currentPhase;
            const phaseConfig = config.withoutProductPhases.find(p => p.phase === currentPhase);
            const expectedROI = activeInvestment.amount * phaseConfig.rate;
            console.log(`  ROI: Expected ${expectedROI}, Got ${roiReward.amount} (${roiReward.amount === expectedROI ? 'PASS' : 'FAIL'})`);

            const matchingRewards = await UserStakeReward.find({ stakeId: sale._id, type: 'level_income' });
            console.log(`Matching Bonuses Distributed: ${matchingRewards.length}/8`);
            matchingRewards.forEach((r, idx) => {
                const expectedRate = config.matchingBonusRates[idx];
                const expectedAmt = roiReward.amount * expectedRate;
                console.log(`  Matching Level ${idx + 1}: Expected ${expectedAmt}, Got ${r.amount} (${r.amount === expectedAmt ? 'PASS' : 'FAIL'})`);
            });
        }

        console.log('--- SYSTEM TEST COMPLETE ---');
        process.exit();
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
};

runTest();
