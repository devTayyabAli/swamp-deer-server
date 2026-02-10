# Investment Phase & Progression Logic

This document explains how the system detects and manages the **Current Phase** and **Months Completed** for an investment.

## 1. Initial State
When an investment is activated (via `activateStake` in `stakeService.js`):
- `monthsCompleted` is set to **0**.
- `currentPhase` is set to **1**.
- `rewardPercentage` is set to the rate for Phase 1.

## 2. Monthly Progression
The progression is handled by the **Profit Share Distribution Cron** (`rewardCron.js`).

Every time a monthly reward is successfully distributed:
1. **Increment Months**: The system increases the counter:
   ```javascript
   investment.monthsCompleted += 1;
   ```
2. **Check for Transition**: It immediately calls `checkPhaseTransition(investment, monthsInCurrent)`.

## 3. Detecting Phase Changes
The logic for detecting if a phase change is needed resides in `checkPhaseTransition` within `stakeService.js`.

### Step A: Calculate Months in Current Phase
First, it determines how many months have been completed *within the current phase*.
It does this by subtracting the total months of all *previous* phases.

*Formula:*
```
MonthsInCurrent = TotalMonthsCompleted - (Sum of months in all previous phases)
```

### Step B: Compare with Phase Duration
It looks up the configuration for the current phase (from `investmentPlans.js`).
- If `MonthsInCurrent` >= `CurrentPhaseDuration`, the phase is complete.

### Step C: Execute Transition
If the phase is complete:
1. **Increment Phase**: `investment.currentPhase += 1`
2. **Update Rate**: The `rewardPercentage` is updated to the new phase's rate.
3. **Log Event**: The transition is saved and logged.

## 4. Phase Configurations
The system supports two plan types with different phase structures:

### A. With Product Plan (12 Months Total)
- **Phase 1**: Months 1-4 (4 months) @ **5%**
- **Phase 2**: Months 5-8 (4 months) @ **6%**
- **Phase 3**: Months 9-12 (4 months) @ **7%**

### B. Without Product Plan (12 Months Total)
- **Phase 1**: Months 1-3 (3 months) @ **7%**
- **Phase 2**: Months 4-6 (3 months) @ **8%**
- **Phase 3**: Months 7-9 (3 months) @ **9%**
- **Phase 4**: Months 10-12 (3 months) @ **10%**

## Example Scenario (Without Product)
1. **Start**: Month 0, Phase 1, Rate 7%.
2. **Month 1-3 Rewards**: `monthsCompleted` becomes 1, then 2, then 3.
3. **At Month 3**:
   - `MonthsInCurrent` = 3.
   - Phase 1 duration is 3 months.
   - Condition Met! Transition to **Phase 2**.
   - New Rate: **8%**.
4. **Month 4 Reward**: Paid at 8%. `monthsCompleted` becomes 4.

## 5. Completion
The investment is marked as `completed` when:
- `monthsCompleted` reaches **12** (Total Duration).
- OR the **Profit Cap** (5x investment) is reached.
