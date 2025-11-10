const { Pool } = require("pg");
require("dotenv").config();

/**
 * PostgreSQL Database Connection Pool
 * Handles all database operations for the reward system
 */
class Database {
  constructor() {
    // Create connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || "reward_system",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("❌ Unexpected database error:", err);
    });

    console.log("✅ Database connection pool created");
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.pool.query("SELECT NOW()");
      console.log("✅ Database connected at:", result.rows[0].now);
      return true;
    } catch (error) {
      console.error("❌ Database connection failed:", error.message);
      throw error;
    }
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  /**
   * Create or get user by wallet address
   */
  async upsertUser(walletAddress, username = null, email = null) {
    const query = `
      INSERT INTO users (wallet_address, username, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet_address) 
      DO UPDATE SET 
        username = COALESCE(EXCLUDED.username, users.username),
        email = COALESCE(EXCLUDED.email, users.email),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    
    const result = await this.pool.query(query, [walletAddress, username, email]);
    return result.rows[0];
  }

  /**
   * Get user by wallet address
   */
  async getUserByWallet(walletAddress) {
    const query = "SELECT * FROM users WHERE wallet_address = $1";
    const result = await this.pool.query(query, [walletAddress]);
    return result.rows[0];
  }

  /**
   * Update user points (after blockchain confirmation)
   */
  async updateUserPoints(walletAddress, points, operation = "add") {
    const query = `
      UPDATE users 
      SET total_points = total_points ${operation === "add" ? "+" : "-"} $1::bigint,
          updated_at = CURRENT_TIMESTAMP
      WHERE wallet_address = $2
      RETURNING *;
    `;
    
    const result = await this.pool.query(query, [points, walletAddress]);
    return result.rows[0];
  }

  /**
   * Get user summary with stats
   */
  async getUserSummary(walletAddress) {
    const query = "SELECT * FROM v_user_summary WHERE wallet_address = $1";
    const result = await this.pool.query(query, [walletAddress]);
    return result.rows[0];
  }

  // ============================================
  // TRIP OPERATIONS
  // ============================================

  /**
   * Insert trip record (after blockchain confirmation)
   */
  async insertTrip(tripData) {
    const query = `
      INSERT INTO trips (
        trip_id, user_id, wallet_address, mode, distance, duration,
        points_earned, emissions_saved, trip_hash, tx_hash, block_number, verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (wallet_address, trip_id) DO UPDATE SET
        tx_hash = EXCLUDED.tx_hash,
        block_number = EXCLUDED.block_number,
        verified = EXCLUDED.verified
      RETURNING *;
    `;

    const values = [
      tripData.tripId,
      tripData.userId,
      tripData.walletAddress,
      tripData.mode,
      tripData.distance,
      tripData.duration,
      tripData.pointsEarned,
      tripData.emissionsSaved,
      tripData.tripHash,
      tripData.txHash,
      tripData.blockNumber,
      tripData.verified ?? true,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get trip history for user
   */
  async getTripHistory(walletAddress, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM trips 
      WHERE wallet_address = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3;
    `;
    
    const result = await this.pool.query(query, [walletAddress, limit, offset]);
    return result.rows;
  }

  /**
   * Get trip by hash
   */
  async getTripByHash(tripHash) {
    const query = "SELECT * FROM trips WHERE trip_hash = $1";
    const result = await this.pool.query(query, [tripHash]);
    return result.rows[0];
  }

  /**
   * Verify trip (update verified status)
   */
  async verifyTrip(tripHash, verified = true) {
    const query = `
      UPDATE trips 
      SET verified = $1, updated_at = CURRENT_TIMESTAMP
      WHERE trip_hash = $2
      RETURNING *;
    `;
    
    const result = await this.pool.query(query, [verified, tripHash]);
    return result.rows[0];
  }

  /**
   * Get trip statistics by mode
   */
  async getTripStatsByMode() {
    const query = `
      SELECT 
        mode,
        COUNT(*) as trip_count,
        SUM(points_earned) as total_points,
        SUM(emissions_saved) as total_emissions,
        AVG(distance) as avg_distance,
        AVG(duration) as avg_duration
      FROM trips
      GROUP BY mode
      ORDER BY trip_count DESC;
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // ============================================
  // REDEMPTION OPERATIONS
  // ============================================

  /**
   * Insert redemption record
   */
  async insertRedemption(redemptionData) {
    const query = `
      INSERT INTO redemptions (
        redemption_id, user_id, wallet_address, reward_id, reward_name,
        points_cost, tx_hash, block_number, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      redemptionData.redemptionId,
      redemptionData.userId,
      redemptionData.walletAddress,
      redemptionData.rewardId,
      redemptionData.rewardName,
      redemptionData.pointsCost,
      redemptionData.txHash,
      redemptionData.blockNumber,
      redemptionData.status || "completed",
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get redemption history for user
   */
  async getRedemptionHistory(walletAddress, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM redemptions 
      WHERE wallet_address = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3;
    `;
    
    const result = await this.pool.query(query, [walletAddress, limit, offset]);
    return result.rows;
  }

  // ============================================
  // REWARDS CATALOG OPERATIONS
  // ============================================

  /**
   * Get all active rewards
   */
  async getActiveRewards() {
    const query = `
      SELECT * FROM rewards 
      WHERE active = true 
      ORDER BY points_cost ASC;
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Get reward by ID
   */
  async getRewardById(rewardId) {
    const query = "SELECT * FROM rewards WHERE reward_id = $1";
    const result = await this.pool.query(query, [rewardId]);
    return result.rows[0];
  }

  /**
   * Update reward stock
   */
  async updateRewardStock(rewardId, decrement = 1) {
    const query = `
      UPDATE rewards 
      SET stock = stock - $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE reward_id = $2 AND stock > 0
      RETURNING *;
    `;
    
    const result = await this.pool.query(query, [decrement, rewardId]);
    return result.rows[0];
  }

  // ============================================
  // SYSTEM STATS OPERATIONS
  // ============================================

  /**
   * Update system stats
   */
  async updateSystemStats() {
    const query = `
      UPDATE system_stats SET
        total_trips = (SELECT COUNT(*) FROM trips),
        total_users = (SELECT COUNT(*) FROM users),
        total_points_issued = (SELECT COALESCE(SUM(total_points), 0) FROM users),
        total_redemptions = (SELECT COUNT(*) FROM redemptions),
        total_emissions_saved = (SELECT COALESCE(SUM(emissions_saved), 0) FROM trips),
        last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *;
    `;
    
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  /**
   * Get system stats
   */
  async getSystemStats() {
    const query = "SELECT * FROM system_stats WHERE id = 1";
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  /**
   * Get leaderboard (top users by points)
   */
  async getLeaderboard(limit = 10) {
    const query = `
      SELECT 
        wallet_address,
        username,
        total_points,
        tier,
        (SELECT COUNT(*) FROM trips WHERE trips.user_id = users.id) as trip_count
      FROM users
      ORDER BY total_points DESC
      LIMIT $1;
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  // ============================================
  // ANALYTICS QUERIES
  // ============================================

  /**
   * Get daily statistics
   */
  async getDailyStats(days = 7) {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as trip_count,
        SUM(points_earned) as points_earned,
        SUM(emissions_saved) as emissions_saved
      FROM trips
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY DATE(created_at)
      ORDER BY date DESC;
    `;
    
    const result = await this.pool.query(query, [String(days)]);
    return result.rows;
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(walletAddress, days = 30) {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as trips,
        SUM(points_earned) as points,
        SUM(emissions_saved) as emissions
      FROM trips
      WHERE wallet_address = $1 
        AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
      GROUP BY DATE(created_at)
      ORDER BY date DESC;
    `;
    
    const result = await this.pool.query(query, [walletAddress, String(days)]);
    return result.rows;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Execute raw query (for testing/admin)
   */
  async query(text, params) {
    return this.pool.query(text, params);
  }

  /**
   * Close pool connection
   */
  async close() {
    await this.pool.end();
    console.log("Database connection pool closed");
  }
}

// Export singleton instance
module.exports = new Database();
