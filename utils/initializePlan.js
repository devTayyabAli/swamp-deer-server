const InvestmentPlan = require('../models/InvestmentPlan');

const initializeGlobalPlan = async () => {
    try {
        const globalPlanExists = await InvestmentPlan.findOne({ scope: 'global' });

        if (!globalPlanExists) {
            console.log('Global Investment Plan not found. Initializing with defaults...');

            const defaultGlobalPlan = {
                scope: 'global',
                referralBonusRates: [0.06, 0.025, 0.02, 0.015, 0.015, 0.01, 0.01, 0.005],
                matchingBonusRates: [0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
                withProductPhases: [
                    { phase: 1, months: 4, rate: 0.05, description: 'First 4 months at 5% monthly' },
                    { phase: 2, months: 4, rate: 0.06, description: 'Second 4 months at 6% monthly' },
                    { phase: 3, months: 4, rate: 0.07, description: 'Third 4 months at 7% monthly' }
                ],
                withoutProductPhases: [
                    { phase: 1, months: 3, rate: 0.07, description: 'First 3 months at 7% monthly' },
                    { phase: 2, months: 3, rate: 0.08, description: 'Second 3 months at 8% monthly' },
                    { phase: 3, months: 3, rate: 0.09, description: 'Third 3 months at 9% monthly' },
                    { phase: 4, months: 3, rate: 0.10, description: 'Fourth 3 months at 10% monthly' }
                ],
                rankTargets: [
                    { rankId: 1, title: 'Sales Executive', withoutProduct: 1500000, withProduct: 3000000 },
                    { rankId: 2, title: 'Sales Officer', withoutProduct: 4500000, withProduct: 9000000 },
                    { rankId: 3, title: 'Sales Manager', withoutProduct: 13500000, withProduct: 27000000 },
                    { rankId: 4, title: 'Regional Sales Manager', withoutProduct: 40500000, withProduct: 81000000 },
                    { rankId: 5, title: 'Regional Director', withoutProduct: 121500000, withProduct: 243000000 },
                    { rankId: 6, title: 'Zonal Head', withoutProduct: 364500000, withProduct: 729000000 },
                    { rankId: 7, title: 'Director', withoutProduct: 1093500000, withProduct: 2187000000 },
                    { rankId: 8, title: 'Ambassador', withoutProduct: 3280500000, withProduct: 6561000000 }
                ],
                profitCapMultiplier: 5
            };

            await InvestmentPlan.create(defaultGlobalPlan);
            console.log('Global Investment Plan initialized successfully.');
        }
    } catch (error) {
        console.error('Error initializing global plan:', error);
    }
};

module.exports = initializeGlobalPlan;
