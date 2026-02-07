// functions/src/services/database.ts
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 * Supports both Cloud SQL Proxy (local) and Cloud SQL Socket (production)
 */
export function getDatabase(): Pool {
  if (!pool) {
    const isCloudRun = process.env.K_SERVICE !== undefined; // Detect Cloud Run environment
    const pgConfig: any = {
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DB || 'low_emission_mobility',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased to 30s for Cloud SQL SSL connections
      statement_timeout: 30000, // 30 second statement timeout
      query_timeout: 30000, // 30 second query timeout
    };

    // Configure host connection
    if (isCloudRun && process.env.CLOUD_SQL_CONNECTION_NAME) {
      // Cloud Run with Cloud SQL Socket
      pgConfig.host = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
      console.log('Using Cloud SQL Socket connection:', pgConfig.host);
    } else if (process.env.PG_HOST?.startsWith('/cloudsql/')) {
      // Explicit Cloud SQL Socket path from env
      pgConfig.host = process.env.PG_HOST;
      console.log('Using Cloud SQL Socket from env:', pgConfig.host);
    } else {
      // Local connection (via Cloud SQL Proxy or direct)
      pgConfig.host = process.env.PG_HOST || 'localhost';
      pgConfig.port = parseInt(process.env.PG_PORT || '5432');
      
      // For Cloud SQL public IP, SSL is optional (instance has require_ssl: false)
      if (pgConfig.host !== 'localhost' && pgConfig.host !== '127.0.0.1') {
        pgConfig.ssl = false; // Cloud SQL allow_public_ip doesn't require SSL
        console.log(`Using TCP connection to ${pgConfig.host}:${pgConfig.port}`);
      } else {
        pgConfig.ssl = false;
        console.log(`Using TCP connection to ${pgConfig.host}:${pgConfig.port}`);
      }
    }

    try {
      pool = new Pool(pgConfig);

      pool.on('error', (err: Error) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });

      pool.on('connect', () => {
        console.log('PostgreSQL client connected');
      });

      console.log('PostgreSQL connection pool initialized');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL pool:', error);
      throw error;
    }
  }

  return pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    const pgPool = getDatabase();
    const result = await pgPool.query('SELECT NOW()');
    console.log('PostgreSQL connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('PostgreSQL connection failed:', error);
    return false;
  }
}

/**
 * Initialize database schema if not exists
 * This creates all necessary tables for the application
 */
export async function initializeSchema(): Promise<void> {
  const pgPool = getDatabase();
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        points_balance INT DEFAULT 0,
        total_trips INT DEFAULT 0,
        total_distance_km FLOAT DEFAULT 0,
        total_co2_saved_kg FLOAT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Trips table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        start_ts BIGINT,
        stop_ts BIGINT,
        distance_m FLOAT,
        distance_km FLOAT,
        mode VARCHAR(50),
        mode_prob FLOAT,
        co2_kg FLOAT,
        points INT,
        status VARCHAR(50) DEFAULT 'confirmed',
        auto_stopped BOOLEAN DEFAULT false,
        route JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Vouchers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        partner VARCHAR(255),
        cost_points INT NOT NULL,
        stock INT,
        description TEXT,
        active BOOLEAN DEFAULT true,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Redemptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS redemptions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        voucher_id VARCHAR(255) NOT NULL,
        points_spent INT,
        status VARCHAR(50) DEFAULT 'pending',
        blockchain_tx VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON redemptions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    await client.query('COMMIT');
    console.log('Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Schema initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function syncToPostgres(tripId: string, tripData: any): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `INSERT INTO trips (
        id, user_id, start_ts, stop_ts, distance_m, distance_km, 
        mode, mode_prob, co2_kg, points, status, auto_stopped, 
        route, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         stop_ts = EXCLUDED.stop_ts,
         distance_m = EXCLUDED.distance_m,
         distance_km = EXCLUDED.distance_km,
         mode = EXCLUDED.mode,
         mode_prob = EXCLUDED.mode_prob,
         co2_kg = EXCLUDED.co2_kg,
         points = EXCLUDED.points,
         status = EXCLUDED.status,
         auto_stopped = EXCLUDED.auto_stopped,
         route = EXCLUDED.route,
         updated_at = NOW()`,
      [
        tripId,
        tripData.userId,
        tripData.startedAt,
        tripData.stoppedAt,
        tripData.distance_m,
        tripData.distance_km || (tripData.distance_m ? tripData.distance_m / 1000 : 0),
        tripData.mode,
        tripData.mode_prob,
        tripData.co2_kg,
        tripData.points,
        tripData.status || 'confirmed',
        tripData.auto_stopped || false,
        tripData.route ? JSON.stringify(tripData.route) : null
      ]
    );

    console.log(`Trip ${tripId} synced to PostgreSQL`);
  } catch (error) {
    console.error('PostgreSQL sync error:', error);
    throw error;
  }
}

export async function syncUserToPostgres(userId: string, userData: any): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `INSERT INTO users (
        id, username, email, display_name, password_hash, 
        points_balance, total_trips, total_distance_km, total_co2_saved_kg, 
        created_at, last_active
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         points_balance = EXCLUDED.points_balance,
         total_trips = EXCLUDED.total_trips,
         total_distance_km = EXCLUDED.total_distance_km,
         total_co2_saved_kg = EXCLUDED.total_co2_saved_kg,
         last_active = NOW()`,
      [
        userId,
        userData.username,
        userData.email,
        userData.displayName || '',
        userData.passwordHash,
        userData.pointsBalance || 0,
        userData.totalTrips || 0,
        userData.totalDistanceKm || 0,
        userData.totalCO2SavedKg || 0
      ]
    );

    console.log(`User ${userId} synced to PostgreSQL`);
  } catch (error) {
    console.error('PostgreSQL user sync error:', error);
    throw error;
  }
}

/**
 * Get user from PostgreSQL by username
 */
export async function getUserByUsername(username: string): Promise<any> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Get user by username error:', error);
    throw error;
  }
}

/**
 * Get user from PostgreSQL by ID
 */
export async function getUserById(userId: string): Promise<any> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Get user by ID error:', error);
    throw error;
  }
}

/**
 * Create or update user in PostgreSQL
 */
export async function createOrUpdateUser(userId: string, userData: any): Promise<void> {
  await syncUserToPostgres(userId, userData);
}

/**
 * Update user points in PostgreSQL
 */
export async function updateUserPoints(userId: string, pointsDelta: number): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `UPDATE users 
       SET points_balance = points_balance + $1, last_active = NOW()
       WHERE id = $2`,
      [pointsDelta, userId]
    );

    console.log(`User ${userId} points updated by ${pointsDelta}`);
  } catch (error) {
    console.error('Update user points error:', error);
    throw error;
  }
}

export async function batchSyncTrips(trips: Array<{ id: string; data: any }>): Promise<void> {
  const pgPool = getDatabase();
  const client: PoolClient = await pgPool.connect();

  try {
    await client.query('BEGIN');

    for (const trip of trips) {
      await client.query(
        `INSERT INTO trips (id, user_id, start_ts, stop_ts, distance_m, mode, co2_kg, points, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          trip.id,
          trip.data.userId,
          trip.data.startedAt,
          trip.data.stoppedAt,
          trip.data.distance_m,
          trip.data.mode,
          trip.data.co2_kg,
          trip.data.points
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Batch synced ${trips.length} trips to PostgreSQL`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch sync error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserStatsFromPostgres(userId: string): Promise<any> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT 
         COUNT(*) as total_trips,
         SUM(distance_m) / 1000.0 as total_distance_km,
         SUM(co2_kg) as total_co2_kg,
         SUM(points) as total_points,
         MAX(created_at) as last_trip_date
       FROM trips
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
}

export async function getDailyStats(startDate: Date, endDate: Date): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as trip_count,
         COUNT(DISTINCT user_id) as active_users,
         SUM(distance_m) / 1000.0 as total_distance_km,
         SUM(co2_kg) as total_co2_kg,
         SUM(points) as total_points
       FROM trips
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [startDate, endDate]
    );

    return result.rows;
  } catch (error) {
    console.error('Get daily stats error:', error);
    throw error;
  }
}

export async function getModeStats(): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT 
         mode,
         COUNT(*) as trip_count,
         SUM(distance_m) / 1000.0 as total_distance_km,
         AVG(distance_m) / 1000.0 as avg_distance_km,
         SUM(co2_kg) as total_co2_kg,
         SUM(points) as total_points
       FROM trips
       GROUP BY mode
       ORDER BY trip_count DESC`
    );

    return result.rows;
  } catch (error) {
    console.error('Get mode stats error:', error);
    throw error;
  }
}

export async function getLeaderboard(limit: number = 100): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT 
         u.id,
         u.username,
         u.display_name,
         u.email,
         u.points_balance,
         COUNT(t.id) as trip_count,
         SUM(t.distance_m) / 1000.0 as total_distance_km,
         SUM(t.co2_kg) as total_co2_kg,
         RANK() OVER (ORDER BY u.points_balance DESC) as points_rank
       FROM users u
       LEFT JOIN trips t ON u.id = t.user_id
       GROUP BY u.id, u.username, u.display_name, u.email, u.points_balance
       ORDER BY u.points_balance DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Get leaderboard error:', error);
    throw error;
  }
}

/**
 * Get available vouchers from PostgreSQL
 */
export async function getAvailableVouchers(): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT * FROM vouchers 
       WHERE active = true 
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_to IS NULL OR valid_to >= NOW())
       AND (stock IS NULL OR stock > 0)
       ORDER BY cost_points ASC`
    );

    return result.rows;
  } catch (error) {
    console.error('Get available vouchers error:', error);
    throw error;
  }
}

/**
 * Get voucher by ID
 */
export async function getVoucherById(voucherId: string): Promise<any> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      'SELECT * FROM vouchers WHERE id = $1',
      [voucherId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Get voucher error:', error);
    throw error;
  }
}

/**
 * Create or update voucher
 */
export async function createOrUpdateVoucher(
  voucherId: string,
  voucherData: any
): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `INSERT INTO vouchers (
        id, title, partner, cost_points, stock, description, 
        active, valid_from, valid_to, created_at, last_updated
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         partner = EXCLUDED.partner,
         cost_points = EXCLUDED.cost_points,
         stock = EXCLUDED.stock,
         description = EXCLUDED.description,
         active = EXCLUDED.active,
         valid_from = EXCLUDED.valid_from,
         valid_to = EXCLUDED.valid_to,
         last_updated = NOW()`,
      [
        voucherId,
        voucherData.title,
        voucherData.partner || null,
        voucherData.cost_points,
        voucherData.stock || null,
        voucherData.description || null,
        voucherData.active !== false,
        voucherData.valid_from || null,
        voucherData.valid_to || null
      ]
    );

    console.log(`Voucher ${voucherId} synced to PostgreSQL`);
  } catch (error) {
    console.error('Create/update voucher error:', error);
    throw error;
  }
}

/**
 * Decrement voucher stock
 */
export async function decrementVoucherStock(voucherId: string): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `UPDATE vouchers 
       SET stock = stock - 1, last_updated = NOW()
       WHERE id = $1 AND (stock IS NULL OR stock > 0)`,
      [voucherId]
    );

    console.log(`Voucher ${voucherId} stock decremented`);
  } catch (error) {
    console.error('Decrement voucher stock error:', error);
    throw error;
  }
}

/**
 * Create redemption record
 */
export async function createRedemption(
  redemptionId: string,
  userId: string,
  voucherId: string,
  pointsSpent: number
): Promise<void> {
  const pgPool = getDatabase();

  try {
    await pgPool.query(
      `INSERT INTO redemptions (id, user_id, voucher_id, points_spent, status, created_at)
       VALUES ($1, $2, $3, $4, 'completed', NOW())`,
      [redemptionId, userId, voucherId, pointsSpent]
    );

    console.log(`Redemption ${redemptionId} created in PostgreSQL`);
  } catch (error) {
    console.error('Create redemption error:', error);
    throw error;
  }
}

/**
 * Get redemption history for user
 */
export async function getRedemptionHistory(userId: string): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT 
         r.id, r.points_spent, r.status, r.created_at,
         v.title, v.partner, v.cost_points
       FROM redemptions r
       JOIN vouchers v ON r.voucher_id = v.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Get redemption history error:', error);
    throw error;
  }
}

/**
 * Get trips for user
 */
export async function getTripsForUser(userId: string, limit: number = 100): Promise<any[]> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(
      `SELECT * FROM trips 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Get user trips error:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
}

export async function executeQuery(query: string, params: any[] = []): Promise<any> {
  const pgPool = getDatabase();

  try {
    const result = await pgPool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Execute query error:', error);
    throw error;
  }
}

export async function healthCheck(): Promise<{
  status: string;
  database: string;
  timestamp: Date;
}> {
  try {
    const pgPool = getDatabase();
    const result = await pgPool.query('SELECT current_database(), NOW()');
    
    return {
      status: 'healthy',
      database: result.rows[0].current_database,
      timestamp: result.rows[0].now
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      database: 'unknown',
      timestamp: new Date()
    };
  }
}