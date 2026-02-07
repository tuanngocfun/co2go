const { expect } = require("chai");
const { ethers } = require("hardhat");
const rewardCalculator = require("../backend/rewardCalculator");

/**
 * Integration Tests
 * Tests the complete flow from diagram/reward-system.mermaid
 * 
 * Flow tested:
 * 1. Phase 1: Trip Submission & Classification
 * 2. Phase 2: Points Query & Verification
 * 3. Phase 3: Reward Redemption
 */

describe("Reward System Integration Tests", function () {
  let rewardSystem;
  let owner;
  let user1;
  let user2;

  before(async function () {
    // Deploy contract
    [owner, user1, user2] = await ethers.getSigners();
    
    const RewardSystem = await ethers.getContractFactory("RewardSystem");
    rewardSystem = await RewardSystem.deploy();
    await rewardSystem.waitForDeployment();

    console.log("\n✅ Contract deployed for integration tests");
    console.log("📍 Address:", await rewardSystem.getAddress());
    console.log("👤 User1:", user1.address);
  });

  describe("Phase 1: Trip Submission & Classification", function () {
    it("Should calculate points correctly using reward calculator", function () {
      const tripData = {
        mode: "bike",
        distance: 5000,  // 5 km
        duration: 1200,  // 20 minutes
      };

      // Test validation
      const validation = rewardCalculator.validateTripData(
        tripData.mode,
        tripData.distance,
        tripData.duration
      );
      expect(validation.valid).to.be.true;

      // Test calculation with new formula
      const reward = rewardCalculator.calculateTripReward(
        tripData.mode,
        tripData.distance,
        tripData.duration
      );

      // Expected with new formula:
      // Base: (5km * 10) + (20min * 2) = 50 + 40 = 90 points
      // Emissions saved: (177 - 0) * 5 = 885g
      // Bonus: 885 / 100 = 8 points
      // Total: 90 + 8 = 98 points
      expect(reward.pointsEarned).to.equal(98);
      expect(reward.emissionsSaved).to.equal(885); // 5km * 177g/km (car baseline)
      expect(reward.breakdown.distanceKm).to.equal("5.00");
      expect(reward.breakdown.durationMin).to.equal("20.0");
    });

    it("Should record trip on blockchain", async function () {
      const tripId = 1;
      const mode = "bike";
      const distance = 5000;
      const duration = 1200;

      // Record trip
      const tx = await rewardSystem.recordTrip(
        tripId,
        user1.address,
        mode,
        distance,
        duration
      );

      await tx.wait();

      // Verify trip was recorded (on-chain now uses same formula as backend)
      // Base: (5km * 10) + (20min * 2) = 90 points
      // Emissions saved: (177 - 0) * 5 = 885g
      // Bonus: 885 / 100 = 8 points
      // Total: 90 + 8 = 98 points
      const balance = await rewardSystem.getBalance(user1.address);
      expect(balance).to.equal(98);

      // Get trip history
      const trips = await rewardSystem.getTripHistory(user1.address);
      expect(trips.length).to.equal(1);
      expect(trips[0].mode).to.equal("bike");
      expect(trips[0].distance).to.equal(distance);
    });

    it("Should prevent duplicate trip recording", async function () {
      const tripId = 1; // Same trip ID
      const mode = "bike";
      const distance = 5000;
      const duration = 1200;

      // Try to record same trip again
      await expect(
        rewardSystem.recordTrip(tripId, user1.address, mode, distance, duration)
      ).to.be.revertedWith("Trip already recorded");
    });

    it("Should calculate emissions saved correctly", async function () {
      const trips = await rewardSystem.getTripHistory(user1.address);
      const trip = trips[0];

      // 5km by bike vs car: 5 * 177 = 885g CO2 saved (using aligned car baseline)
      expect(trip.emissionsSaved).to.equal(885);
    });
  });

  describe("Phase 2: Points Query & Verification", function () {
    it("Should get correct balance from blockchain", async function () {
      const balance = await rewardSystem.getBalance(user1.address);
      expect(balance).to.equal(98); // On-chain now matches backend formula
    });

    it("Should verify trip on blockchain", async function () {
      const trips = await rewardSystem.getTripHistory(user1.address);
      const tripHash = trips[0].tripHash;

      const verified = await rewardSystem.verifyTrip(tripHash);
      expect(verified).to.be.true;
    });

    it("Should calculate tier correctly", async function () {
      const tier = await rewardSystem.calculateTier(user1.address);
      expect(tier).to.equal("Bronze"); // < 500 points

      // Add more trips to reach Silver (500+ points)
      for (let i = 2; i <= 6; i++) {
        await rewardSystem.recordTrip(i, user1.address, "bike", 5000, 1200);
      }

      const newTier = await rewardSystem.calculateTier(user1.address);
      expect(newTier).to.equal("Silver"); // 6 trips × 98 = 588 points (Silver tier ≥ 500)
    });

    it("Should get complete user stats", async function () {
      const stats = await rewardSystem.getUserStats(user1.address);

      expect(stats.tripCount).to.equal(6);
      expect(stats.tier).to.equal("Silver");
      expect(Number(stats.balance)).to.be.greaterThan(500);
      expect(Number(stats.totalEmissionsSaved)).to.be.greaterThan(0);
    });

    it("Should calculate tier progress using off-chain calculator", function () {      // Use the actual on-chain balance after 6 trips: 6 × 98 = 588
      const progress = rewardCalculator.getTierProgress(588);

      expect(progress.currentTier).to.equal("Silver");
      expect(progress.nextTier).to.equal("Gold");
      expect(progress.pointsToNext).to.equal(2000 - 588); // 1412 points to Gold
    });
  });

  describe("Phase 3: Reward Redemption", function () {
    it("Should get reward details", async function () {
      const reward = await rewardSystem.getReward("COFFEE_VOUCHER");

      expect(reward.name).to.equal("Free Coffee");
      expect(reward.pointsCost).to.equal(100);
      expect(reward.active).to.be.true;
    });

    it("Should redeem reward successfully", async function () {
      const initialBalance = await rewardSystem.getBalance(user1.address);

      // Redeem coffee voucher (100 points)
      await rewardSystem.redeemReward(user1.address, "COFFEE_VOUCHER", 100);

      const newBalance = await rewardSystem.getBalance(user1.address);
      expect(newBalance).to.equal(initialBalance - 100n);

      // Check redemption history
      const redemptions = await rewardSystem.getRedemptionHistory(user1.address);
      expect(redemptions.length).to.equal(1);
      expect(redemptions[0].rewardId).to.equal("COFFEE_VOUCHER");
      expect(redemptions[0].pointsCost).to.equal(100);
    });

    it("Should fail redemption with insufficient points", async function () {
      // Try to redeem bike rental (750 points) - user doesn't have enough
      await expect(
        rewardSystem.redeemReward(user1.address, "BIKE_RENTAL", 750)
      ).to.be.revertedWith("Insufficient points");
    });

    it("Should track total redemptions", async function () {
      const totalRedemptions = await rewardSystem.totalRedemptions();
      expect(totalRedemptions).to.equal(1);
    });
  });

  describe("Reward Calculator - Advanced Features", function () {
    it("Should validate trip data correctly", function () {
      // Valid trip
      let validation = rewardCalculator.validateTripData("bike", 5000, 1200);
      expect(validation.valid).to.be.true;

      // Invalid mode
      validation = rewardCalculator.validateTripData("flying_car", 5000, 1200);
      expect(validation.valid).to.be.false;
      // Error message should include all modes from emission factors
      expect(validation.errors[0]).to.include("Invalid mode");

      // Invalid distance
      validation = rewardCalculator.validateTripData("bike", -100, 1200);
      expect(validation.valid).to.be.false;

      // Invalid duration
      validation = rewardCalculator.validateTripData("bike", 5000, 0);
      expect(validation.valid).to.be.false;

      // Unrealistic speed
      validation = rewardCalculator.validateTripData("walk", 50000, 600); // 50km in 10 min = 300 km/h
      expect(validation.valid).to.be.false;
    });

    it("Should compare different modes correctly", function () {
      const comparison = rewardCalculator.compareModes(5000, 1200);

      // Sorted descending by points
      expect(comparison[0].points).to.be.at.least(comparison[comparison.length - 1].points);

      // Walking / biking (zero direct emissions) should be among the best
      expect(comparison[0].mode).to.be.oneOf(["walk", "bike", "ebike"]);

      // Car should give fewer points than walking or biking
      const car = comparison.find(c => c.mode === "car");
      const best = comparison[0];

      expect(car).to.exist;
      expect(Number(car.points)).to.be.lessThan(Number(best.points));

      // Modes array should include all configured emission factors
      const modesFromComparison = comparison.map(c => c.mode).sort();
      const modesFromConfig = Object.keys(rewardCalculator.emissionFactors).sort();
      expect(modesFromComparison).to.deep.equal(modesFromConfig);
    });

    it("Should calculate environmental impact", function () {
      const totalEmissions = 10000; // 10kg CO2
      const impact = rewardCalculator.calculateEnvironmentalImpact(totalEmissions);

      expect(parseFloat(impact.totalKg)).to.equal(10);
      expect(parseFloat(impact.treesEquivalent)).to.be.greaterThan(0);
      expect(parseInt(impact.carKmEquivalent)).to.be.greaterThan(0);
      expect(impact.message).to.include("10.0kg");
    });

    it("Should get all emission factors", function () {
      const factors = rewardCalculator.emissionFactors;

      expect(factors.car).to.equal(177);  // Aligned with UK DESNZ 2024
      expect(factors.bike).to.equal(0);
      expect(factors.bus).to.equal(105);  // Aligned average
      expect(factors.train).to.equal(35); // Aligned with UK DESNZ 2024
    });

    it("Should get tier requirements", function () {
      const tiers = rewardCalculator.getTierRequirements();

      expect(tiers.length).to.equal(4);
      expect(tiers[0].tier).to.equal("Bronze");
      expect(tiers[1].tier).to.equal("Silver");
      expect(tiers[2].tier).to.equal("Gold");
      expect(tiers[3].tier).to.equal("Diamond");
    });
  });

  describe("Multiple Users Scenario", function () {
    it("Should handle multiple users independently", async function () {
      // User2 makes a trip
      await rewardSystem.recordTrip(1, user2.address, "walk", 2000, 1800);

      // Check balances are independent
      const balance1 = await rewardSystem.getBalance(user1.address);
      const balance2 = await rewardSystem.getBalance(user2.address);

      expect(balance2).to.not.equal(balance1);

      // Check trip counts
      const trips1 = await rewardSystem.getTripHistory(user1.address);
      const trips2 = await rewardSystem.getTripHistory(user2.address);

      expect(trips1.length).to.equal(6); // From previous tests
      expect(trips2.length).to.equal(1);
    });

    it("Should track total system stats", async function () {
      const totalTrips = await rewardSystem.totalTrips();
      const totalPoints = await rewardSystem.totalPointsIssued();

      expect(totalTrips).to.be.greaterThan(0);
      expect(totalPoints).to.be.greaterThan(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very small trips", async function () {
      const tripId = Date.now();
      await rewardSystem.recordTrip(tripId, user1.address, "walk", 100, 60);

      const trips = await rewardSystem.getTripHistory(user1.address);
      const lastTrip = trips[trips.length - 1];

      // Should still award some points even for small trip
      expect(lastTrip.pointsEarned).to.be.greaterThan(0);
    });

    it("Should handle large trips", async function () {
      const tripId = Date.now() + 1;
      await rewardSystem.recordTrip(tripId, user1.address, "train", 100000, 7200); // 100km, 2h

      const trips = await rewardSystem.getTripHistory(user1.address);
      const lastTrip = trips[trips.length - 1];

      // Should award significant points
      expect(lastTrip.pointsEarned).to.be.greaterThan(1000);
    });

    it("Should handle different transport modes", async function () {
      const modes = ["walk", "bike", "bus", "train"];
      let tripId = Date.now() + 100;

      for (const mode of modes) {
        await rewardSystem.recordTrip(tripId++, user2.address, mode, 3000, 900);
      }

      const trips = await rewardSystem.getTripHistory(user2.address);
      const usedModes = trips.map(t => t.mode);

      expect(usedModes).to.include.members(modes);
    });
  });
});
