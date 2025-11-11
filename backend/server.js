const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const { ethers } = require("ethers");
require("dotenv").config();

const rewardService = require("./rewardService");
const rewardCalculator = require("./rewardCalculator");
const database = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev")); // Logging

// ============================================
// HEALTH CHECK
// ============================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Reward System API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      trips: {
        submit: "POST /api/trips/submit",
        history: "GET /api/trips/history/:walletAddress",
        verify: "GET /api/trips/verify/:tripHash",
        stats: "GET /api/trips/stats",
      },
      points: {
        balance: "GET /api/points/balance/:walletAddress",
        calculate: "POST /api/points/calculate",
      },
      rewards: {
        catalog: "GET /api/rewards/catalog",
        redeem: "POST /api/rewards/redeem",
        history: "GET /api/rewards/history/:walletAddress",
      },
      users: {
        summary: "GET /api/users/summary/:walletAddress",
        leaderboard: "GET /api/users/leaderboard",
        activity: "GET /api/users/activity/:walletAddress",
      },
      system: {
        stats: "GET /api/system/stats",
        daily: "GET /api/system/daily",
      },
    },
  });
});

app.get("/health", async (req, res) => {
  try {
    // Test database connection
    await database.testConnection();
    
    // Test blockchain connection by getting contract stats
    let blockchainStatus = "disconnected";
    let blockchainError = null;
    
    try {
      await rewardService.getContractStats();
      blockchainStatus = "connected";
    } catch (error) {
      blockchainError = error.message;
    }
    
    const isHealthy = blockchainStatus === "connected";
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: isHealthy,
      status: isHealthy ? "healthy" : "unhealthy",
      database: "connected",
      blockchain: blockchainStatus,
      blockchainError: blockchainError,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      database: "disconnected",
      blockchain: "unknown",
      error: error.message,
    });
  }
});

// ============================================
// TRIP ENDPOINTS (Phase 1 from diagram)
// ============================================

/**
 * POST /api/trips/submit
 * Submit a new trip and record on blockchain
 */
app.post("/api/trips/submit", async (req, res) => {
  try {
    const { walletAddress, mode, distance, duration } = req.body;

    // Validate required fields
    if (!walletAddress || !mode || !distance || !duration) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: walletAddress, mode, distance, duration",
      });
    }

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    // Validate trip data
    const validation = rewardCalculator.validateTripData(mode, distance, duration);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid trip data",
        details: validation.errors,
      });
    }

    // Calculate points and emissions
    const reward = rewardCalculator.calculateTripReward(mode, distance, duration);

    // Generate unique trip ID
    const tripId = Date.now();

    // Record trip on blockchain
    const txResult = await rewardService.recordTrip({
      tripId,
      userId: walletAddress,
      mode,
      distance,
      duration,
    });

    // Upsert user in database
    let user = await database.getUserByWallet(walletAddress);
    if (!user) {
      user = await database.upsertUser(walletAddress);
    }

    // Get trip hash from blockchain
    const trips = await rewardService.getTripHistory(walletAddress);
    const latestTrip = trips[trips.length - 1];

    // Insert trip record into database
    await database.insertTrip({
      tripId,
      userId: user.id,
      walletAddress,
      mode,
      distance,
      duration,
      pointsEarned: txResult.pointsEarned,
      emissionsSaved: reward.emissionsSaved,
      tripHash: latestTrip.tripHash,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      verified: true,
    });

    // Update user points in database
    await database.updateUserPoints(walletAddress, txResult.pointsEarned, "add");

    // Update system stats
    await database.updateSystemStats();

    res.json({
      success: true,
      message: "Trip recorded successfully",
      data: {
        tripId,
        pointsEarned: txResult.pointsEarned,
        totalPoints: txResult.totalPoints,
        emissionsSaved: reward.emissionsSaved,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        breakdown: reward.breakdown,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting trip:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/trips/history/:walletAddress
 * Get trip history for a user
 */
app.get("/api/trips/history/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    // Get from database (fast)
    const trips = await database.getTripHistory(walletAddress, limit, offset);

    res.json({
      success: true,
      data: {
        trips,
        count: trips.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("❌ Error getting trip history:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/trips/verify/:tripHash
 * Verify a trip on blockchain
 */
app.get("/api/trips/verify/:tripHash", async (req, res) => {
  try {
    const { tripHash } = req.params;

    // Verify on blockchain
    const blockchainResult = await rewardService.verifyTrip(tripHash);

    // Get from database
    const dbTrip = await database.getTripByHash(tripHash);

    res.json({
      success: true,
      data: {
        verified: blockchainResult.verified,
        trip: dbTrip,
        source: {
          blockchain: blockchainResult.verified,
          database: !!dbTrip,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error verifying trip:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/trips/stats
 * Get trip statistics by mode
 */
app.get("/api/trips/stats", async (req, res) => {
  try {
    const stats = await database.getTripStatsByMode();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error getting trip stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// POINTS ENDPOINTS (Phase 2 from diagram)
// ============================================

/**
 * GET /api/points/balance/:walletAddress
 * Get user points balance
 */
app.get("/api/points/balance/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    // Get from blockchain (source of truth)
    const blockchainBalance = await rewardService.getBalance(walletAddress);
    const tier = await rewardService.getUserTier(walletAddress);

    // Get from database
    const user = await database.getUserByWallet(walletAddress);

    // Get tier progress
    const balance = parseInt(blockchainBalance.balance);
    const tierProgress = rewardCalculator.getTierProgress(balance);

    res.json({
      success: true,
      data: {
        balance: blockchainBalance.balance,
        tier: tier.tier,
        tierProgress,
        source: {
          blockchain: blockchainBalance.balance,
          database: user ? user.total_points : 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting balance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/points/calculate
 * Calculate points for a hypothetical trip (no blockchain transaction)
 */
app.post("/api/points/calculate", (req, res) => {
  try {
    const { mode, distance, duration } = req.body;

    if (!mode || !distance || !duration) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: mode, distance, duration",
      });
    }

    // Validate
    const validation = rewardCalculator.validateTripData(mode, distance, duration);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid trip data",
        details: validation.errors,
      });
    }

    // Calculate
    const reward = rewardCalculator.calculateTripReward(mode, distance, duration);

    res.json({
      success: true,
      data: reward,
    });
  } catch (error) {
    console.error("❌ Error calculating points:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// REWARDS ENDPOINTS (Phase 3 from diagram)
// ============================================

/**
 * GET /api/rewards/catalog
 * Get all available rewards
 */
app.get("/api/rewards/catalog", async (req, res) => {
  try {
    const rewards = await database.getActiveRewards();

    res.json({
      success: true,
      data: rewards,
    });
  } catch (error) {
    console.error("❌ Error getting rewards catalog:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rewards/redeem
 * Redeem a reward
 */
app.post("/api/rewards/redeem", async (req, res) => {
  try {
    const { walletAddress, rewardId } = req.body;

    if (!walletAddress || !rewardId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: walletAddress, rewardId",
      });
    }

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    // Get reward details
    const reward = await database.getRewardById(rewardId);
    if (!reward) {
      return res.status(404).json({
        success: false,
        error: "Reward not found",
      });
    }

    if (!reward.active) {
      return res.status(400).json({
        success: false,
        error: "Reward is not active",
      });
    }

    // Check stock
    if (reward.stock !== -1 && reward.stock <= 0) {
      return res.status(400).json({
        success: false,
        error: "Reward is out of stock",
      });
    }

    // Redeem on blockchain
    const txResult = await rewardService.redeemReward(
      walletAddress,
      rewardId,
      reward.points_cost
    );

    // Get user
    const user = await database.getUserByWallet(walletAddress);

    // Insert redemption record
    const redemptionId = Date.now();
    await database.insertRedemption({
      redemptionId,
      userId: user.id,
      walletAddress,
      rewardId,
      rewardName: reward.name,
      pointsCost: reward.points_cost,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      status: "completed",
    });

    // Update user points
    await database.updateUserPoints(walletAddress, reward.points_cost, "subtract");

    // Update reward stock
    if (reward.stock !== -1) {
      await database.updateRewardStock(rewardId, 1);
    }

    // Update system stats
    await database.updateSystemStats();

    res.json({
      success: true,
      message: "Reward redeemed successfully",
      data: {
        rewardId,
        rewardName: reward.name,
        pointsCost: reward.points_cost,
        newBalance: txResult.newBalance,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error redeeming reward:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rewards/history/:walletAddress
 * Get redemption history
 */
app.get("/api/rewards/history/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    const redemptions = await database.getRedemptionHistory(walletAddress, limit, offset);

    res.json({
      success: true,
      data: {
        redemptions,
        count: redemptions.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("❌ Error getting redemption history:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /api/users/summary/:walletAddress
 * Get complete user summary with stats
 */
app.get("/api/users/summary/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    // Get from blockchain
    const stats = await rewardService.getUserStats(walletAddress);

    // Get from database
    const summary = await database.getUserSummary(walletAddress);

    // Get tier progress
    const tierProgress = rewardCalculator.getTierProgress(parseInt(stats.balance));

    // Calculate environmental impact
    const impact = rewardCalculator.calculateEnvironmentalImpact(
      parseInt(stats.totalEmissionsSaved)
    );

    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        points: {
          balance: stats.balance,
          tier: stats.tier,
          tierProgress,
        },
        activity: {
          tripCount: stats.tripCount,
          redemptionCount: stats.redemptionCount,
        },
        environmental: {
          totalEmissionsSaved: stats.totalEmissionsSaved,
          impact,
        },
        database: summary,
      },
    });
  } catch (error) {
    console.error("❌ Error getting user summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/leaderboard
 * Get top users by points
 */
app.get("/api/users/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await database.getLeaderboard(limit);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("❌ Error getting leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/activity/:walletAddress
 * Get user activity over time
 */
app.get("/api/users/activity/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const days = parseInt(req.query.days) || 30;

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address",
      });
    }

    const activity = await database.getUserActivity(walletAddress, days);

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("❌ Error getting user activity:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// SYSTEM ENDPOINTS
// ============================================

/**
 * GET /api/system/stats
 * Get system-wide statistics
 */
app.get("/api/system/stats", async (req, res) => {
  try {
    const stats = await database.getSystemStats();
    const contractStats = await rewardService.getContractStats();

    res.json({
      success: true,
      data: {
        database: stats,
        blockchain: contractStats,
      },
    });
  } catch (error) {
    console.error("❌ Error getting system stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/system/daily
 * Get daily statistics
 */
app.get("/api/system/daily", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const dailyStats = await database.getDailyStats(days);

    res.json({
      success: true,
      data: dailyStats,
    });
  } catch (error) {
    console.error("❌ Error getting daily stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Test database connection
    await database.testConnection();
    console.log("✅ Database connected");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Reward System API running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`💡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  await database.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\nSIGINT received, closing server...");
  await database.close();
  process.exit(0);
});

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
