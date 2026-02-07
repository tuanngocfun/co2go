// functions/src/index-simplified.ts
// Simplified Cloud Functions - Username/Password Auth Only
import * as functions from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { processTrip, updateTripMode, getUserStats } from "./services/trip-processor";
import { handleRedemption, getAvailableVouchers, getRedemptionHistory } from "./services/redemption-service";
import { syncToPostgres, healthCheck as dbHealthCheck, initializeSchema, getDatabase } from "./services/database";
import { blockchainHealthCheck } from "./services/blockchain";
import { simpleRegister, simpleLogin, verifyUsername, getUserByUsername } from "./services/simple-auth";
import { 
  recordTripOnChain, 
  getTokenBalance as getBlockchainBalance, 
  getTripHistory as getBlockchainTripHistory,
  redeemRewardOnChain,
  getUserStats as getBlockchainUserStats,
  getTokenInfo,
  blockchainHealthCheck as polygonHealthCheck 
} from "./services/blockchain-polygon";

// Initialize Firebase Admin
admin.initializeApp();
const getDb = () => admin.firestore();

// ============================================================================
// AUTHENTICATION ENDPOINTS (Simplified - Username/Password only)
// ============================================================================

/**
 * Register new user with username and password
 * POST /register
 * Body: { username, password, email, displayName }
 */
export const register = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username, password, email, displayName } = req.body;

    // Validation
    if (!username || !password || !email || !displayName) {
      res.status(400).json({ 
        error: 'Missing required fields: username, password, email, displayName' 
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
      return;
    }

    const result = await simpleRegister(username, password, email, displayName);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ 
      error: error.message || 'Registration failed' 
    });
  }
});

/**
 * Login user with username and password
 * POST /login
 * Body: { username, password }
 */
export const login = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({ 
        error: 'Missing required fields: username, password' 
      });
      return;
    }

    const result = await simpleLogin(username, password);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: error.message || 'Login failed' 
    });
  }
});

/**
 * Verify username exists
 * GET /verify-username?username=...
 */
export const verifyUsernameEndpoint = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const username = req.query.username as string;
    
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const exists = await verifyUsername(username);
    res.status(200).json({ 
      username,
      exists,
      available: !exists
    });

  } catch (error: any) {
    console.error('Verify username error:', error);
    res.status(500).json({ 
      error: error.message || 'Verification failed' 
    });
  }
});

/**
 * Get user profile by username
 * GET /user/:username
 */
export const getUserProfile = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const username = req.query.username as string;
    
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const user = await getUserByUsername(username);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Return user info without password hash
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        pointsBalance: user.pointsBalance,
        totalTrips: user.totalTrips,
        createdAt: user.createdAt
      }
    });

  } catch (error: any) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get user profile' 
    });
  }
});

// ============================================================================
// TRIP ENDPOINTS
// ============================================================================

/**
 * Finish trip and calculate emissions
 * POST /finishTrip
 * Body: { username, gpsPoints, localDistanceMeters, startedAt, stoppedAt }
 */
export const finishTrip = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username, gpsPoints, localDistanceMeters, startedAt, stoppedAt } = req.body;

    // Verify username exists
    const user = await getUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Create a request-like object for processTrip
    const mockReq = {
      body: { gpsPoints, localDistanceMeters, startedAt, stoppedAt },
      headers: { 'x-user-id': user.id }
    };

    const result = await processTrip(mockReq);
    
    // Update user points
    const db = getDb();
    await db.collection('simple_users').doc(user.id).update({
      pointsBalance: (user.pointsBalance || 0) + (result.points || 0),
      totalTrips: (user.totalTrips || 0) + 1,
      totalDistanceKm: ((user as any).totalDistanceKm || 0) + (result.distance_km || 0),
      totalCO2SavedKg: ((user as any).totalCO2SavedKg || 0) + (result.co2_kg || 0)
    });

    res.status(200).json({
      success: true,
      trip: result,
      user: {
        pointsBalance: (user.pointsBalance || 0) + (result.points || 0)
      }
    });

  } catch (error: any) {
    console.error('Finish trip error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process trip' 
    });
  }
});

/**
 * Update trip mode
 * POST /updateTripMode
 * Body: { username, tripId, newMode }
 */
export const updateTripModeHandler = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username, tripId, newMode } = req.body;

    // Verify username exists
    const user = await getUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Create a request-like object for updateTripMode
    const mockReq = {
      body: { tripId, newMode },
      headers: { 'x-user-id': user.id }
    };

    const result = await updateTripMode(mockReq);

    res.status(200).json({
      success: true,
      trip: result
    });

  } catch (error: any) {
    console.error('Update trip mode error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update trip mode' 
    });
  }
});

/**
 * Get user statistics
 * GET /userStats?username=...
 */
export const getUserStatsHandler = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const username = req.query.username as string;

    // Verify username exists
    const user = await getUserByUsername(username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create a request-like object for getUserStats
    const mockReq = {
      headers: { 'x-user-id': user.id }
    };

    const stats = await getUserStats(mockReq);

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('Get user stats error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get user statistics' 
    });
  }
});

// ============================================================================
// VOUCHER ENDPOINTS
// ============================================================================

/**
 * Get available vouchers
 * GET /vouchers?username=...
 */
export const getVouchers = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const username = req.query.username as string;
    let userId: string | undefined;

    // Verify username exists
    if (username) {
      const user = await getUserByUsername(username);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      userId = user.id;
    }

    const vouchers = await getAvailableVouchers({ headers: { 'x-user-id': userId } });

    res.status(200).json({
      success: true,
      vouchers
    });

  } catch (error: any) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get vouchers' 
    });
  }
});

/**
 * Redeem voucher
 * POST /redeemVoucher
 * Body: { username, voucherId, userAddress }
 */
export const redeemVoucher = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('[redeemVoucher] Request received');
  console.log('[redeemVoucher] Body:', JSON.stringify(req.body));

  try {
    const { username, voucherId, userAddress } = req.body;

    if (!username) {
      console.log('[redeemVoucher] ERROR: username not provided in body');
      res.status(400).json({ error: 'username is required in request body' });
      return;
    }

    if (!voucherId) {
      console.log('[redeemVoucher] ERROR: voucherId not provided in body');
      res.status(400).json({ error: 'voucherId is required in request body' });
      return;
    }

    console.log(`[redeemVoucher] Looking up user: ${username}`);

    // Verify username exists
    const user = await getUserByUsername(username);
    if (!user) {
      console.log(`[redeemVoucher] ERROR: User not found: ${username}`);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    console.log(`[redeemVoucher] User found: id=${user.id}, points=${user.pointsBalance}`);

    // Create a request-like object for handleRedemption
    const mockReq = {
      body: { voucherId, userAddress },
      headers: { 'x-user-id': user.id }
    };

    console.log(`[redeemVoucher] Calling handleRedemption with userId=${user.id}, voucherId=${voucherId}`);

    const result = await handleRedemption(mockReq);

    console.log('[redeemVoucher] SUCCESS:', JSON.stringify(result));

    res.status(200).json({
      success: true,
      redemption: result
    });

  } catch (error: any) {
    console.error('[redeemVoucher] Error:', error.message);
    console.error('[redeemVoucher] Stack:', error.stack);
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to redeem voucher' 
    });
  }
});

/**
 * Get redemption history
 * GET /redemptions?username=...
 */
export const getRedemptions = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const username = req.query.username as string;

    // Verify username exists
    const user = await getUserByUsername(username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const redemptions = await getRedemptionHistory(user.id);

    res.status(200).json({
      success: true,
      redemptions
    });

  } catch (error: any) {
    console.error('Get redemptions error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get redemption history' 
    });
  }
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * GET /health
 */
export const health = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const db = getDb();
    
    // Check Firestore connectivity
    const testDoc = await db.collection('_health_check').doc('test').get();
    
    res.status(200).json({
      success: true,
      status: 'ok',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      services: {
        firestore: 'operational',
        functions: 'operational'
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      error: error.message || 'Service unavailable'
    });
  }
});

// ============================================================================
// POLYGON AMOY BLOCKCHAIN ENDPOINTS
// ============================================================================

/**
 * Record trip on Polygon Amoy blockchain
 * POST /recordBlockchainTrip
 * Body: { walletAddress, mode, distanceMeters, durationSeconds }
 */
export const recordBlockchainTrip = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { walletAddress, mode, distanceMeters, durationSeconds } = req.body;

    if (!walletAddress || !mode || !distanceMeters || !durationSeconds) {
      res.status(400).json({ 
        error: 'Missing required fields: walletAddress, mode, distanceMeters, durationSeconds' 
      });
      return;
    }

    // Generate trip ID
    const tripId = Date.now();

    console.log(`[recordBlockchainTrip] Recording trip for ${walletAddress}`);
    
    const result = await recordTripOnChain(
      tripId,
      walletAddress,
      mode,
      distanceMeters,
      durationSeconds
    );

    res.status(200).json({
      success: true,
      tripId,
      ...result,
      message: `Trip recorded! Earned ${result.pointsEarned} C2GP tokens`
    });

  } catch (error: any) {
    console.error('[recordBlockchainTrip] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to record trip on blockchain' 
    });
  }
});

/**
 * Get token balance from Polygon Amoy
 * GET /tokenBalance?walletAddress=0x...
 */
export const tokenBalance = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const walletAddress = req.query.walletAddress as string;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

    const balance = await getBlockchainBalance(walletAddress);

    res.status(200).json({
      success: true,
      walletAddress,
      ...balance
    });

  } catch (error: any) {
    console.error('[tokenBalance] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get token balance' 
    });
  }
});

/**
 * Get trip history from Polygon Amoy
 * GET /blockchainTripHistory?walletAddress=0x...
 */
export const blockchainTripHistory = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const walletAddress = req.query.walletAddress as string;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

    const trips = await getBlockchainTripHistory(walletAddress);

    res.status(200).json({
      success: true,
      walletAddress,
      trips
    });

  } catch (error: any) {
    console.error('[blockchainTripHistory] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get trip history' 
    });
  }
});

/**
 * Redeem reward on Polygon Amoy blockchain
 * POST /blockchainRedeemReward
 * Body: { walletAddress, rewardId, pointsCost }
 */
export const blockchainRedeemReward = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { walletAddress, rewardId, pointsCost } = req.body;

    if (!walletAddress || !rewardId || !pointsCost) {
      res.status(400).json({ 
        error: 'Missing required fields: walletAddress, rewardId, pointsCost' 
      });
      return;
    }

    console.log(`[blockchainRedeemReward] Redeeming ${rewardId} for ${walletAddress}`);
    
    const result = await redeemRewardOnChain(walletAddress, rewardId, pointsCost);

    res.status(200).json({
      success: true,
      ...result,
      message: `Reward ${rewardId} redeemed successfully!`
    });

  } catch (error: any) {
    console.error('[blockchainRedeemReward] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to redeem reward' 
    });
  }
});

/**
 * Get token info for MetaMask
 * GET /tokenInfo
 */
export const tokenInfoEndpoint = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const info = await getTokenInfo();

    res.status(200).json({
      success: true,
      ...info,
      instructions: {
        step1: 'Open MetaMask',
        step2: 'Click "Import tokens"',
        step3: 'Paste token address',
        step4: 'Symbol and decimals will auto-fill'
      }
    });

  } catch (error: any) {
    console.error('[tokenInfo] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get token info' 
    });
  }
});

/**
 * Blockchain health check (Polygon Amoy)
 * GET /blockchainHealth
 */
export const blockchainHealth = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const health = await polygonHealthCheck();

    res.status(health.status === 'healthy' ? 200 : 503).json({
      success: health.status === 'healthy',
      ...health
    });

  } catch (error: any) {
    console.error('[blockchainHealth] Error:', error);
    res.status(503).json({ 
      success: false,
      status: 'error',
      error: error.message 
    });
  }
});

// ============================================================================
// INITIALIZATION ENDPOINTS
// ============================================================================

/**
 * Initialize database schema
 * Called automatically on first function startup
 */
export const initSchema = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    await initializeSchema();
    
    res.status(200).json({
      success: true,
      message: 'Database schema initialized',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Schema initialization error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Schema initialization failed'
    });
  }
});

/**
 * Initialize user profile
 * POST /initializeUser
 * Body: { username }
 */
export const initializeUser = onRequest(async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const user = await getUserByUsername(username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User profile initialized',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    });

  } catch (error: any) {
    console.error('Initialize user error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to initialize user' 
    });
  }
});

// ============================================================================
// PLACEHOLDER ENDPOINTS FOR FUTURE FEATURES
// ============================================================================

/**
 * Sync trip to PostgreSQL (for analytics)
 * This is a placeholder - implement as needed
 */
export const syncTripToPostgres = onDocumentUpdated(
  'trips/{tripId}',
  async (event) => {
    console.log('Trip updated:', event.data?.after.id);
    // Sync logic here
  }
);

/**
 * Calculate daily stats - runs every day at midnight UTC
 * Aggregates trip data, emissions, and user performance
 */
export const calculateDailyStats = onSchedule('every day 00:00', async (context) => {
  console.log('Calculating daily stats...');
  // Calculate logic here
  
  try {
    const pgPool = getDatabase();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`Calculating stats for: ${yesterday.toISOString().split('T')[0]}`);
    
    // 1. Calculate overall daily stats
    const overallStats = await pgPool.query(`
      SELECT 
        DATE($1) as date,
        COUNT(*) as total_trips,
        COUNT(DISTINCT user_id) as active_users,
        SUM(distance_km) as total_distance_km,
        SUM(co2_kg) as total_co2_kg,
        SUM(points) as total_points,
        AVG(distance_km) as avg_distance_km
      FROM trips
      WHERE created_at >= $1 AND created_at < $2
    `, [yesterday, today]);
    
    // 2. Calculate stats by transport mode
    const modeStats = await pgPool.query(`
      SELECT 
        mode,
        COUNT(*) as trip_count,
        SUM(distance_km) as total_distance_km,
        SUM(co2_kg) as total_co2_kg,
        SUM(points) as total_points
      FROM trips
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY mode
      ORDER BY trip_count DESC
    `, [yesterday, today]);
    
    // 3. Calculate top users of the day
    const topUsers = await pgPool.query(`
      SELECT 
        u.id,
        u.username,
        u.display_name,
        COUNT(t.id) as trip_count,
        SUM(t.distance_km) as total_distance_km,
        SUM(t.points) as points_earned,
        SUM(CASE WHEN t.mode IN ('walk', 'bike') THEN 1 ELSE 0 END) as eco_trips
      FROM users u
      LEFT JOIN trips t ON u.id = t.user_id 
        AND t.created_at >= $1 AND t.created_at < $2
      GROUP BY u.id, u.username, u.display_name
      HAVING COUNT(t.id) > 0
      ORDER BY points_earned DESC
      LIMIT 10
    `, [yesterday, today]);
    
    // 4. Calculate CO2 savings (compared to car)
    const co2Savings = await pgPool.query(`
      SELECT 
        SUM(
          CASE 
            WHEN mode IN ('walk', 'bike', 'bus', 'train', 'subway')
            THEN (180 * distance_km / 1000) - co2_kg  -- Car emission - actual emission
            ELSE 0 
          END
        ) as total_co2_saved_kg
      FROM trips
      WHERE created_at >= $1 AND created_at < $2
    `, [yesterday, today]);
    
    // 5. Store daily stats in database
    const statsData = overallStats.rows[0];
    
    await pgPool.query(`
      INSERT INTO daily_stats (
        date, total_trips, active_users, total_distance_km, 
        total_co2_kg, total_points, avg_distance_km, 
        mode_breakdown, top_users, co2_saved_kg, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (date) DO UPDATE SET
        total_trips = EXCLUDED.total_trips,
        active_users = EXCLUDED.active_users,
        total_distance_km = EXCLUDED.total_distance_km,
        total_co2_kg = EXCLUDED.total_co2_kg,
        total_points = EXCLUDED.total_points,
        avg_distance_km = EXCLUDED.avg_distance_km,
        mode_breakdown = EXCLUDED.mode_breakdown,
        top_users = EXCLUDED.top_users,
        co2_saved_kg = EXCLUDED.co2_saved_kg,
        updated_at = NOW()
    `, [
      statsData.date,
      statsData.total_trips || 0,
      statsData.active_users || 0,
      statsData.total_distance_km || 0,
      statsData.total_co2_kg || 0,
      statsData.total_points || 0,
      statsData.avg_distance_km || 0,
      JSON.stringify(modeStats.rows),
      JSON.stringify(topUsers.rows),
      co2Savings.rows[0].total_co2_saved_kg || 0
    ]);
    
    console.log('Daily stats calculated successfully:');
    console.log(`   - Total trips: ${statsData.total_trips}`);
    console.log(`   - Active users: ${statsData.active_users}`);
    console.log(`   - Distance: ${statsData.total_distance_km} km`);
    console.log(`   - CO2 saved: ${co2Savings.rows[0].total_co2_saved_kg} kg`);
    console.log(`   - Points awarded: ${statsData.total_points}`);
    
    // 6. Optional: Send summary email to admins
    // await sendDailyReportEmail(statsData);
    
  } catch (error) {
    console.error('Error calculating daily stats:', error);
    throw error;
  } 
});

/**
 * Cleanup old sessions
 * This is a placeholder - implement as needed
 */
export const cleanupOldSessions = onSchedule('every day 00:00', async (context) => {
  console.log('Cleaning up old sessions...');
  // Cleanup logic here
});

/**
 * Update user points total
 * This is a placeholder - implement as needed
 */
export const updateUserPointsTotal = onSchedule('every day 01:00', async (context) => {
  console.log('Updating user points totals...');
  // Update logic here
});
