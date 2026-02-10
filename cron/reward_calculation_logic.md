# Reward Calculation Logic

This document details how monthly rewards and bonuses are calculated and distributed by the system's Cron Job (`rewardCron.js`) and associated services (`stakeService.js`).

## 1. Schedule & Frequency

The reward distribution process runs automatically based on the environment:

- **Development Mode**: Every **5 minutes** (`*/5 * * * *`)
- **Production Mode**: Every **1 hour** (`0 * * * *`)

Although the job runs frequently, it checks each individual investment to see if it has "matured" for the current cycle.

## 2. Investment Selection

The system fetches all **Active** investments (`Sale` records with `status: 'active'`).

For each investment, it checks if enough time has passed since the last reward:
- **Development**: **10 minutes** must pass.
- **Production**: **30 days** must pass.

If the time condition is met, the system proceeds to calculate the reward.

## 3. Calculation Steps

### Step 1: Determine Profit Rate
The profit rate is determined by the current phase of the investment plan.
- **Standard**: Uses `investment.rewardPercentage`.
- **Phased Plans**: Calls `calculateCurrentPhaseRate()` to get the rate for the specific phase (e.g., Phase 1 might be 5%, Phase 2 might be 6%).

### Step 2: Calculate Base Reward Amount
The base monthly profit amount is calculated as:
```javascript
Base Reward = Investment Amount × Profit Rate
```
*Example: Rs 100,000 Investment × 5% Rate = Rs 5,000 Reward*

### Step 3: Profit Cap Check
The system enforces a maximum profit cap (typically 5x the investment amount).
It calculates:
```javascript
Current Total Profit + Proposed Reward <= Profit Cap
```
If the new reward would exceed the cap, it is reduced to exactly hit the cap.
*If `allowedAmount` becomes 0, the investment is marked as `completed`.*

### Step 4: Create Reward Record
If the reward amount > 0, a `UserStakingReward` record is created with:
- **Type**: `'staking'`
- **Amount**: The calculated base reward
- **Description**: "Monthly Profit Share..."

## 4. Multi-Level Bonuses (Matching Bonus)

Once a monthly profit reward is distributed to an investor, the system triggers the **Matching Bonus** distribution for the upline chain.

This is handled by `distributeMatchingBonuses()` in `stakeService.js`.

**Logic:**
1. Moves up the referral chain (Upline) for **8 Levels**.
2. Calculates a bonus based on the **Monthly Profit Amount** (not the investment amount).
3. Rates are based on the level depth:

| Upline Level | Bonus Rate (of Monthly Profit) |
| :--- | :--- |
| Level 1 (Direct Upline) | **6%** |
| Level 2 | **5%** |
| Level 3 | **4%** |
| Level 4 | **3%** |
| Level 5 | **3%** |
| Level 6 | **2%** |
| Level 7 | **2%** |
| Level 8 | **1%** |

*Example: If Investor gets Rs 5,000 profit:*
- *Level 1 Upline gets: 5,000 × 6% = Rs 300*
- *Level 2 Upline gets: 5,000 × 5% = Rs 250*
- *...and so on.*

These bonuses are stored as `UserStakingReward` with type `'level_income'`.

## 5. Phase Transition & Completion

After distributing rewards, the system updates the investment status:
1. **Phase Transition**: Checks if the current phase duration is complete (e.g., after 12 months). If so, it moves to the next phase with a new profit rate.
2. **Completion**:
   - If **Profit Cap** is reached.
   - OR if **Total Duration** (e.g., 24 months) is completed.
   - The investment status is set to `'completed'` and it stops earning rewards.

## Summary of Reward Types

| Reward Type | Source | Calculation Base | Frequency |
| :--- | :--- | :--- | :--- |
| **Staking (Profit Share)** | `rewardCron` | Investment Amount × Rate | Monthly |
| **Level Income (Matching)** | `rewardCron` | Investor's Monthly Profit × Level Rate | Monthly |
| **Direct Income (Referral)** | `processCompletedSale` | Investment Amount × Level Rate | **One-time** (on activation) |

