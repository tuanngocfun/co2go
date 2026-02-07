const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RewardSystem Contract", function () {
  let rewardSystem;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const RewardSystem = await ethers.getContractFactory("RewardSystem");
    rewardSystem = await RewardSystem.deploy();
    await rewardSystem.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await rewardSystem.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero trips and redemptions", async function () {
      expect(await rewardSystem.totalTrips()).to.equal(0);
      expect(await rewardSystem.totalRedemptions()).to.equal(0);
    });

    it("Should have default rewards configured", async function () {
      const coffeeReward = await rewardSystem.getReward("COFFEE_VOUCHER");
      expect(coffeeReward.name).to.equal("Free Coffee");
      expect(coffeeReward.pointsCost).to.equal(100);
      expect(coffeeReward.active).to.equal(true);
    });
  });

  describe("Trip Recording", function () {
    it("Should record a trip and award points", async function () {
      const tripId = 1;
      const mode = "bike";
      const distance = 5000; // 5 km
      const duration = 1200; // 20 minutes

      await expect(
        rewardSystem.recordTrip(tripId, user1.address, mode, distance, duration)
      )
        .to.emit(rewardSystem, "TripRecorded")
        .withArgs(
          user1.address,
          tripId,
          mode,
          98, // Base: (5km * 10) + (20min * 2) = 90, Emissions bonus: 885/100 = 8, Total: 98
          anyValue
        );

      const balance = await rewardSystem.getBalance(user1.address);
      expect(balance).to.equal(98); // 90 base + 8 emissions bonus = 98 points
    });

    it("Should prevent duplicate trip recording", async function () {
      const tripId = 1;
      const mode = "walk";
      const distance = 2000;
      const duration = 1800;

      await rewardSystem.recordTrip(tripId, user1.address, mode, distance, duration);

      await expect(
        rewardSystem.recordTrip(tripId, user1.address, mode, distance, duration)
      ).to.be.revertedWith("Trip already recorded");
    });

    it("Should calculate points correctly for different modes", async function () {
      // Test 1: 10km bike ride, 30 minutes
      // Base: (10*10) + (30*2) = 160
      // Emissions: (177 - 0) * 10 = 1770g, bonus: 17
      // Total: 177 points
      await rewardSystem.recordTrip(1, user1.address, "bike", 10000, 1800);
      expect(await rewardSystem.getBalance(user1.address)).to.equal(177);

      // Test 2: 3km walk, 45 minutes
      // Base: (3*10) + (45*2) = 120
      // Emissions: (177 - 0) * 3 = 531g, bonus: 5
      // Total: 125 points
      await rewardSystem.recordTrip(2, user1.address, "walk", 3000, 2700);
      expect(await rewardSystem.getBalance(user1.address)).to.equal(302); // 177 + 125
    });

    it("Should track trip history", async function () {
      await rewardSystem.recordTrip(1, user1.address, "bike", 5000, 1200);
      await rewardSystem.recordTrip(2, user1.address, "walk", 2000, 1800);

      const trips = await rewardSystem.getTripHistory(user1.address);
      expect(trips.length).to.equal(2);
      expect(trips[0].mode).to.equal("bike");
      expect(trips[1].mode).to.equal("walk");
    });

    it("Should calculate emissions saved correctly", async function () {
      // 5km by bike vs car: 5 * 177 = 885g CO2 saved (using aligned baseline)
      await rewardSystem.recordTrip(1, user1.address, "bike", 5000, 1200);
      
      const trips = await rewardSystem.getTripHistory(user1.address);
      expect(trips[0].emissionsSaved).to.equal(885);
    });
  });

  describe("Balance and Queries", function () {
    beforeEach(async function () {
      await rewardSystem.recordTrip(1, user1.address, "bike", 5000, 1200);
      await rewardSystem.recordTrip(2, user2.address, "walk", 3000, 1800);
    });

    it("Should return correct balance for users", async function () {
      // user1: 5km bike, 20min = 98 points
      expect(await rewardSystem.getBalance(user1.address)).to.equal(98);
      // user2: 3km walk, 30min = Base: (3*10)+(30*2)=90, Emissions: 3*177=531, Bonus: 5, Total: 95
      expect(await rewardSystem.getBalance(user2.address)).to.equal(95);
    });

    it("Should verify trip existence", async function () {
      const trips = await rewardSystem.getTripHistory(user1.address);
      const tripHash = trips[0].tripHash;
      
      expect(await rewardSystem.verifyTrip(tripHash)).to.equal(true);
    });

    it("Should calculate user tier correctly", async function () {
      // Bronze tier (< 500 points)
      expect(await rewardSystem.calculateTier(user1.address)).to.equal("Bronze");

      // Add more trips to reach Silver (500+)
      for (let i = 3; i < 10; i++) {
        await rewardSystem.recordTrip(i, user1.address, "bike", 5000, 1200);
      }
      expect(await rewardSystem.calculateTier(user1.address)).to.equal("Silver");
    });
  });

  describe("Reward Redemption", function () {
    beforeEach(async function () {
      // Give user1 enough points (500)
      for (let i = 1; i <= 6; i++) {
        await rewardSystem.recordTrip(i, user1.address, "bike", 5000, 1200);
      }
    });

    it("Should redeem reward successfully", async function () {
      const initialBalance = await rewardSystem.getBalance(user1.address);
      
      await expect(
        rewardSystem.redeemReward(user1.address, "COFFEE_VOUCHER", 100)
      )
        .to.emit(rewardSystem, "RewardRedeemed")
        .withArgs(user1.address, "COFFEE_VOUCHER", 100, initialBalance - 100n);

      const newBalance = await rewardSystem.getBalance(user1.address);
      expect(newBalance).to.equal(initialBalance - 100n);
    });

    it("Should fail redemption with insufficient points", async function () {
      await expect(
        rewardSystem.redeemReward(user1.address, "BIKE_RENTAL", 750)
      ).to.be.revertedWith("Insufficient points");
    });

    it("Should fail redemption for inactive reward", async function () {
      await rewardSystem.updateRewardStatus("COFFEE_VOUCHER", false);
      
      await expect(
        rewardSystem.redeemReward(user1.address, "COFFEE_VOUCHER", 100)
      ).to.be.revertedWith("Reward not available");
    });

    it("Should track redemption history", async function () {
      await rewardSystem.redeemReward(user1.address, "COFFEE_VOUCHER", 100);
      await rewardSystem.redeemReward(user1.address, "BUS_TICKET", 250);

      const redemptions = await rewardSystem.getRedemptionHistory(user1.address);
      expect(redemptions.length).to.equal(2);
      expect(redemptions[0].rewardId).to.equal("COFFEE_VOUCHER");
      expect(redemptions[1].rewardId).to.equal("BUS_TICKET");
    });
  });

  describe("User Statistics", function () {
    beforeEach(async function () {
      await rewardSystem.recordTrip(1, user1.address, "bike", 5000, 1200);
      await rewardSystem.recordTrip(2, user1.address, "walk", 3000, 1800);
      await rewardSystem.redeemReward(user1.address, "COFFEE_VOUCHER", 100);
    });

    it("Should return complete user stats", async function () {
      const stats = await rewardSystem.getUserStats(user1.address);
      
      // Trip 1: 5km bike, 20min = 98 points
      // Trip 2: 3km walk, 30min = 95 points
      // Total: 193, minus 100 redemption = 93 points
      expect(stats.balance).to.equal(93);
      expect(stats.tripCount).to.equal(2);
      expect(stats.redemptionCount).to.equal(1);
      expect(stats.tier).to.equal("Bronze");
      expect(stats.totalEmissionsSaved).to.be.gt(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add new rewards", async function () {
      await expect(
        rewardSystem.addReward("PREMIUM_MEMBERSHIP", "Premium Membership", 2000)
      )
        .to.emit(rewardSystem, "RewardAdded")
        .withArgs("PREMIUM_MEMBERSHIP", "Premium Membership", 2000);

      const reward = await rewardSystem.getReward("PREMIUM_MEMBERSHIP");
      expect(reward.name).to.equal("Premium Membership");
    });

    it("Should prevent non-owner from adding rewards", async function () {
      await expect(
        rewardSystem.connect(user1).addReward("FAKE_REWARD", "Fake", 100)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("Should allow owner to update reward status", async function () {
      await rewardSystem.updateRewardStatus("COFFEE_VOUCHER", false);
      const reward = await rewardSystem.getReward("COFFEE_VOUCHER");
      expect(reward.active).to.equal(false);
    });
  });
});