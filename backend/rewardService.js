const { ethers } = require("ethers");
require("dotenv").config();

// Import contract ABI (generated after compilation)
const RewardSystemABI = require("../artifacts/contracts/RewardSystem.sol/RewardSystem.json").abi;

class RewardService {
  constructor() {
    // Initialize provider
    const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Initialize signer (backend wallet)
    const privateKey = process.env.BACKEND_PRIVATE_KEY;
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize contract
    const contractAddress = process.env.CONTRACT_ADDRESS;
    this.contract = new ethers.Contract(
      contractAddress,
      RewardSystemABI,
      this.signer
    );
    
    console.log("✅ RewardService initialized");
    console.log("📍 Contract:", contractAddress);
    console.log("🔑 Signer:", this.signer.address);
  }

  /**
   * Record a trip on blockchain
   */
  async recordTrip(tripData) {
    try {
      const { tripId, userId, mode, distance, duration } = tripData;
      
      console.log(`📝 Recording trip ${tripId} for user ${userId}...`);
      
      // Call smart contract
      const tx = await this.contract.recordTrip(
        tripId,
        userId, // user wallet address
        mode,
        distance,
        duration
      );
      
      console.log("⏳ Transaction sent:", tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
      
      // Parse events to get points earned (ethers v6)
      let pointsEarned = 0n;
      const iface = this.contract.interface;
      const target = this.contract.target?.toLowerCase?.() || (await this.contract.getAddress()).toLowerCase();
      
      for (const log of receipt.logs) {
        if ((log.address || "").toLowerCase() !== target) continue;
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "TripRecorded") {
            pointsEarned = parsed.args.pointsEarned;
            break;
          }
        } catch (_) {
          // log is not from this contract's ABI
        }
      }
      
      // Get updated balance
      const newBalance = await this.contract.getBalance(userId);
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        pointsEarned: pointsEarned.toString(),
        totalPoints: newBalance.toString(),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("❌ Error recording trip:", error.message);
      throw error;
    }
  }

  /**
   * Get user points balance
   */
  async getBalance(userId) {
    try {
      const balance = await this.contract.getBalance(userId);
      return {
        balance: balance.toString(),
        balanceFormatted: ethers.formatUnits(balance, 0), // Points have no decimals
      };
    } catch (error) {
      console.error("❌ Error getting balance:", error.message);
      throw error;
    }
  }

  /**
   * Get user trip history
   */
  async getTripHistory(userId) {
    try {
      const trips = await this.contract.getTripHistory(userId);
      
      return trips.map(trip => ({
        tripId: trip.tripId.toString(),
        mode: trip.mode,
        distance: trip.distance.toString(),
        duration: trip.duration.toString(),
        pointsEarned: trip.pointsEarned.toString(),
        emissionsSaved: trip.emissionsSaved.toString(),
        timestamp: new Date(Number(trip.timestamp) * 1000).toISOString(),
        tripHash: trip.tripHash,
      }));
    } catch (error) {
      console.error("❌ Error getting trip history:", error.message);
      throw error;
    }
  }

  /**
   * Verify a trip on blockchain
   */
  async verifyTrip(tripHash) {
    try {
      const exists = await this.contract.verifyTrip(tripHash);
      return { verified: exists };
    } catch (error) {
      console.error("❌ Error verifying trip:", error.message);
      throw error;
    }
  }

  /**
   * Redeem a reward
   */
  async redeemReward(userId, rewardId, pointsCost) {
    try {
      console.log(`🎁 Redeeming ${rewardId} for user ${userId}...`);
      
      const tx = await this.contract.redeemReward(userId, rewardId, pointsCost);
      console.log("⏳ Transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Redemption confirmed in block:", receipt.blockNumber);
      
      const newBalance = await this.contract.getBalance(userId);
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        newBalance: newBalance.toString(),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("❌ Error redeeming reward:", error.message);
      
      if (error.message.includes("Insufficient points")) {
        throw new Error("Insufficient points for this reward");
      }
      if (error.message.includes("Reward not available")) {
        throw new Error("This reward is currently unavailable");
      }
      
      throw error;
    }
  }

  /**
   * Get redemption history
   */
  async getRedemptionHistory(userId) {
    try {
      const redemptions = await this.contract.getRedemptionHistory(userId);
      
      return redemptions.map(redemption => ({
        redemptionId: redemption.redemptionId.toString(),
        rewardId: redemption.rewardId,
        pointsCost: redemption.pointsCost.toString(),
        timestamp: new Date(Number(redemption.timestamp) * 1000).toISOString(),
        txHash: redemption.txHash,
      }));
    } catch (error) {
      console.error("❌ Error getting redemption history:", error.message);
      throw error;
    }
  }

  /**
   * Get user tier
   */
  async getUserTier(userId) {
    try {
      const tier = await this.contract.calculateTier(userId);
      return { tier };
    } catch (error) {
      console.error("❌ Error getting user tier:", error.message);
      throw error;
    }
  }

  /**
   * Get complete user stats
   */
  async getUserStats(userId) {
    try {
      const stats = await this.contract.getUserStats(userId);
      
      return {
        balance: stats.balance.toString(),
        tripCount: stats.tripCount.toString(),
        redemptionCount: stats.redemptionCount.toString(),
        tier: stats.tier,
        totalEmissionsSaved: stats.totalEmissionsSaved.toString(),
      };
    } catch (error) {
      console.error("❌ Error getting user stats:", error.message);
      throw error;
    }
  }

  /**
   * Get reward details
   */
  async getReward(rewardId) {
    try {
      const reward = await this.contract.getReward(rewardId);
      
      return {
        rewardId: reward.rewardId,
        name: reward.name,
        pointsCost: reward.pointsCost.toString(),
        active: reward.active,
      };
    } catch (error) {
      console.error("❌ Error getting reward:", error.message);
      throw error;
    }
  }

  /**
   * Listen for TripRecorded events (real-time)
   */
  listenForTripRecorded(callback) {
    this.contract.on("TripRecorded", (user, tripId, mode, pointsEarned, tripHash, event) => {
      const { blockNumber, transactionHash } = event;
      callback({
        user,
        tripId: tripId.toString(),
        mode,
        pointsEarned: pointsEarned.toString(),
        tripHash,
        blockNumber,
        txHash: transactionHash,
      });
    });
    
    console.log("👂 Listening for TripRecorded events...");
  }

  /**
   * Listen for RewardRedeemed events (real-time)
   */
  listenForRewardRedeemed(callback) {
    this.contract.on("RewardRedeemed", (user, rewardId, pointsCost, newBalance, event) => {
      const { blockNumber, transactionHash } = event;
      callback({
        user,
        rewardId,
        pointsCost: pointsCost.toString(),
        newBalance: newBalance.toString(),
        blockNumber,
        txHash: transactionHash,
      });
    });
    
    console.log("👂 Listening for RewardRedeemed events...");
  }

  /**
   * Get contract stats
   */
  async getContractStats() {
    try {
      const totalTrips = await this.contract.totalTrips();
      const totalRedemptions = await this.contract.totalRedemptions();
      const totalPointsIssued = await this.contract.totalPointsIssued();
      
      return {
        totalTrips: totalTrips.toString(),
        totalRedemptions: totalRedemptions.toString(),
        totalPointsIssued: totalPointsIssued.toString(),
      };
    } catch (error) {
      console.error("❌ Error getting contract stats:", error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new RewardService();

// Example usage
if (require.main === module) {
  (async () => {
    const service = new RewardService();
    
    // Example: Record a trip
    const tripData = {
      tripId: 1,
      userId: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat account #0
      mode: "bike",
      distance: 5000, // 5 km
      duration: 1200, // 20 minutes
    };
    
    const result = await service.recordTrip(tripData);
    console.log("📊 Result:", result);
    
    // Get balance
    const balance = await service.getBalance(tripData.userId);
    console.log("💰 Balance:", balance);
  })();
}