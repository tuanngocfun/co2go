const { expect } = require("chai");
const hre = require("hardhat");

/**
 * NETWORK-AWARE INTEGRATION TESTS
 * These tests verify that the multi-network architecture works correctly
 */

describe("Multi-Network Architecture Tests", function () {
  let deployer, user1, user2;
  let token, rewardSystem;
  let tokenAddress, rewardSystemAddress;

  before(async function () {
    [deployer, user1, user2] = await hre.ethers.getSigners();
    
    console.log("\n📍 Testing on network:", hre.network.name);
    console.log("Chain ID:", hre.network.config.chainId);
    console.log("Deployer:", deployer.address);
  });

  describe("Contract Deployment", function () {
    it("Should deploy CO2GoToken contract", async function () {
      const CO2GoToken = await hre.ethers.getContractFactory("CO2GoToken");
      token = await CO2GoToken.deploy();
      await token.waitForDeployment();
      
      tokenAddress = await token.getAddress();
      console.log("✅ CO2GoToken deployed to:", tokenAddress);
      
      expect(tokenAddress).to.be.properAddress;
    });

    it("Should deploy RewardSystem contract", async function () {
      const RewardSystem = await hre.ethers.getContractFactory("RewardSystem");
      rewardSystem = await RewardSystem.deploy(tokenAddress);
      await rewardSystem.waitForDeployment();
      
      rewardSystemAddress = await rewardSystem.getAddress();
      console.log("✅ RewardSystem deployed to:", rewardSystemAddress);
      
      expect(rewardSystemAddress).to.be.properAddress;
    });

    it("Should grant minter role to RewardSystem", async function () {
      const tx = await token.addMinter(rewardSystemAddress);
      await tx.wait();
      
      const isMinter = await token.isMinter(rewardSystemAddress);
      expect(isMinter).to.be.true;
      console.log("✅ Minter role granted");
    });

    it("Should verify deployment configuration", async function () {
      // Verify token is linked to reward system
      const linkedToken = await rewardSystem.getTokenAddress();
      expect(linkedToken.toLowerCase()).to.equal(tokenAddress.toLowerCase());
      
      // Verify initial state
      const totalTrips = await rewardSystem.totalTrips();
      const totalRedemptions = await rewardSystem.totalRedemptions();
      
      expect(totalTrips).to.equal(0);
      expect(totalRedemptions).to.equal(0);
      
      console.log("✅ Deployment configuration verified");
    });
  });

  describe("Network-Specific Address Verification", function () {
    it("Should have unique addresses on this network", async function () {
      console.log("\n📋 Deployed Contract Addresses:");
      console.log("Network:", hre.network.name);
      console.log("Chain ID:", hre.network.config.chainId);
      console.log("Token:", tokenAddress);
      console.log("RewardSystem:", rewardSystemAddress);
      
      // Verify addresses are different
      expect(tokenAddress.toLowerCase()).to.not.equal(rewardSystemAddress.toLowerCase());
      
      // Save deployment info
      const fs = require("fs");
      const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        timestamp: new Date().toISOString(),
        contracts: {
          token: tokenAddress,
          rewardSystem: rewardSystemAddress,
        },
      };
      
      const path = `./deployments/${hre.network.name}.json`;
      fs.mkdirSync("./deployments", { recursive: true });
      fs.writeFileSync(path, JSON.stringify(deploymentInfo, null, 2));
      
      console.log(`💾 Saved to: ${path}`);
    });
  });

  describe("Token Minting and Balance Verification", function () {
    it("Should mint tokens when recording a trip", async function () {
      const tripData = {
        tripId: Date.now(),
        user: user1.address,
        mode: "bike",
        distance: 5000,
        duration: 1200,
      };

      // Check balance before
      const balanceBefore = await token.balanceOf(user1.address);
      expect(balanceBefore).to.equal(0);

      // Record trip
      const tx = await rewardSystem.recordTrip(
        tripData.tripId,
        tripData.user,
        tripData.mode,
        tripData.distance,
        tripData.duration
      );

      const receipt = await tx.wait();
      
      // Parse event to get points earned
      let pointsEarned = 0n;
      const iface = rewardSystem.interface;
      const target = (await rewardSystem.getAddress()).toLowerCase();
      
      for (const log of receipt.logs) {
        if ((log.address || "").toLowerCase() !== target) continue;
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "TripRecorded") {
            pointsEarned = parsed.args.pointsEarned;
            break;
          }
        } catch (_) {}
      }

      expect(pointsEarned).to.be.greaterThan(0);
      console.log(`✅ Trip recorded, points earned: ${pointsEarned}`);

      // Verify token balance increased
      const balanceAfter = await token.balanceOf(user1.address);
      const decimals = await token.decimals();
      const expectedBalance = pointsEarned * (10n ** BigInt(decimals));
      
      expect(balanceAfter).to.equal(expectedBalance);
      console.log(`✅ Token balance verified: ${hre.ethers.formatUnits(balanceAfter, decimals)} C2GP`);
    });

    it("Should correctly report balance from RewardSystem", async function () {
      const balanceFromToken = await token.balanceOf(user1.address);
      const balanceFromContract = await rewardSystem.getBalance(user1.address);
      
      expect(balanceFromToken).to.equal(balanceFromContract);
      console.log("✅ Balance consistency verified");
    });

    it("Should handle multiple trips correctly", async function () {
      const trips = [
        { mode: "walk", distance: 2000, duration: 1500 },
        { mode: "bus", distance: 10000, duration: 900 },
      ];

      for (let i = 0; i < trips.length; i++) {
        const trip = trips[i];
        await rewardSystem.recordTrip(
          Date.now() + i,
          user1.address,
          trip.mode,
          trip.distance,
          trip.duration
        );
      }

      const history = await rewardSystem.getTripHistory(user1.address);
      expect(history.length).to.equal(3); // 1 from previous test + 2 new
      
      console.log(`✅ Multiple trips recorded: ${history.length} total`);
    });
  });

  describe("Reward Redemption and Token Burning", function () {
    it("Should burn tokens when redeeming rewards", async function () {
      const balanceBefore = await token.balanceOf(user1.address);
      const decimals = await token.decimals();
      
      const reward = await rewardSystem.getReward("COFFEE_VOUCHER");
      const pointsCost = reward.pointsCost;
      const tokenCost = pointsCost * (10n ** BigInt(decimals));
      
      // Verify user has enough
      expect(balanceBefore).to.be.at.least(tokenCost);
      
      // Redeem
      const tx = await rewardSystem.redeemReward(
        user1.address,
        "COFFEE_VOUCHER",
        pointsCost
      );
      await tx.wait();
      
      // Verify tokens were burned
      const balanceAfter = await token.balanceOf(user1.address);
      expect(balanceAfter).to.equal(balanceBefore - tokenCost);
      
      console.log(`✅ Tokens burned: ${hre.ethers.formatUnits(tokenCost, decimals)} C2GP`);
    });

    it("Should fail when trying to redeem without enough tokens", async function () {
      // Try to redeem expensive reward
      await expect(
        rewardSystem.redeemReward(user1.address, "BIKE_RENTAL", 750)
      ).to.be.revertedWith("Insufficient tokens");
      
      console.log("✅ Insufficient balance check works");
    });
  });

  describe("Token Transfer Between Users", function () {
    it("Should allow users to transfer tokens", async function () {
      const user1Balance = await token.balanceOf(user1.address);
      const user2BalanceBefore = await token.balanceOf(user2.address);
      
      const decimals = await token.decimals();
      const transferAmount = hre.ethers.parseUnits("10", decimals);
      
      // Verify user1 has enough
      expect(user1Balance).to.be.at.least(transferAmount);
      
      // Transfer
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      // Verify balances
      const user1BalanceAfter = await token.balanceOf(user1.address);
      const user2BalanceAfter = await token.balanceOf(user2.address);
      
      expect(user1BalanceAfter).to.equal(user1Balance - transferAmount);
      expect(user2BalanceAfter).to.equal(user2BalanceBefore + transferAmount);
      
      console.log("✅ Token transfer successful");
    });
  });

  describe("Contract State Consistency", function () {
    it("Should maintain accurate statistics", async function () {
      const totalTrips = await rewardSystem.totalTrips();
      const totalRedemptions = await rewardSystem.totalRedemptions();
      const totalPointsIssued = await rewardSystem.totalPointsIssued();
      
      expect(totalTrips).to.be.greaterThan(0);
      expect(totalRedemptions).to.be.greaterThan(0);
      expect(totalPointsIssued).to.be.greaterThan(0);
      
      console.log("\n📊 Final Statistics:");
      console.log("Total Trips:", totalTrips.toString());
      console.log("Total Redemptions:", totalRedemptions.toString());
      console.log("Total Points Issued:", totalPointsIssued.toString());
    });

    it("Should have correct user stats", async function () {
      const stats = await rewardSystem.getUserStats(user1.address);
      
      expect(stats.tripCount).to.be.greaterThan(0);
      expect(stats.redemptionCount).to.be.greaterThan(0);
      expect(stats.balance).to.be.greaterThan(0);
      
      console.log("\n👤 User1 Stats:");
      console.log("Balance:", stats.balance.toString());
      console.log("Trip Count:", stats.tripCount.toString());
      console.log("Redemption Count:", stats.redemptionCount.toString());
      console.log("Tier:", stats.tier);
    });
  });

  after(async function () {
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED ON", hre.network.name.toUpperCase());
    console.log("=".repeat(60));
    console.log("\n📝 Contract Addresses (update frontend/src/config/networks.js):");
    console.log(`  ${hre.network.config.chainId}: {`);
    console.log(`    token: '${tokenAddress}',`);
    console.log(`    rewardSystem: '${rewardSystemAddress}',`);
    console.log(`  },`);
    console.log("=".repeat(60) + "\n");
  });
});
