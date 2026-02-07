// functions/src/services/trip-processor.ts
// Trip processing service for calculating emissions and points

import { getDatabase } from "./src/services/database";

interface TripData {
  gpsPoints: any[];
  localDistanceMeters: number;
  startedAt: string;
  stoppedAt: string;
}

interface TripResult {
  id: string;
  distance_km: number;
  co2_kg: number;
  points: number;
  mode: string;
  duration_minutes: number;
}

// CO2 emission factors in g/km for different transport modes
const EMISSION_FACTORS: Record<string, number> = {
  walk: 0,
  bike: 0,
  bus: 89,
  subway: 41,
  train: 41,
  car: 180,
  motorcycle: 103
};

// Points per km for different transport modes
const POINTS_PER_KM: Record<string, number> = {
  walk: 10,
  bike: 8,
  bus: 5,
  subway: 6,
  train: 6,
  car: 0,
  motorcycle: 0
};

/**
 * Process a completed trip
 */
export async function processTrip(req: any): Promise<TripResult> {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  const { gpsPoints, localDistanceMeters, startedAt, stoppedAt } = req.body;

  // Calculate distance in km
  const distanceKm = (localDistanceMeters || 0) / 1000;

  // Calculate duration in minutes
  const startTime = new Date(startedAt);
  const endTime = new Date(stoppedAt);
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  // Detect transport mode based on speed
  const avgSpeed = distanceKm / (durationMinutes / 60); // km/h
  const mode = detectTransportMode(avgSpeed);

  // Calculate CO2 emission
  const co2Kg = (distanceKm * EMISSION_FACTORS[mode]) / 1000;

  // Calculate points
  const points = Math.round(distanceKm * POINTS_PER_KM[mode]);

  // Generate trip ID
  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Save to PostgreSQL
  const pgPool = getDatabase();
  await pgPool.query(
    `INSERT INTO trips (id, user_id, distance_km, co2_kg, points, mode, duration_minutes, started_at, stopped_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [tripId, userId, distanceKm, co2Kg, points, mode, durationMinutes, startTime, endTime]
  );

  // Update user totals
  await pgPool.query(
    `UPDATE users SET
       points_balance = points_balance + $2,
       total_trips = total_trips + 1,
       total_distance_km = total_distance_km + $3,
       total_co2_saved_kg = total_co2_saved_kg + $4,
       last_active = NOW()
     WHERE id = $1`,
    [userId, points, distanceKm, (EMISSION_FACTORS.car - EMISSION_FACTORS[mode]) * distanceKm / 1000]
  );

  console.log(`[processTrip] Trip ${tripId} processed: ${distanceKm.toFixed(2)}km, ${points} points, mode: ${mode}`);

  return {
    id: tripId,
    distance_km: distanceKm,
    co2_kg: co2Kg,
    points,
    mode,
    duration_minutes: durationMinutes
  };
}

/**
 * Detect transport mode based on average speed
 */
function detectTransportMode(avgSpeedKmh: number): string {
  if (avgSpeedKmh < 6) return 'walk';
  if (avgSpeedKmh < 25) return 'bike';
  if (avgSpeedKmh < 40) return 'bus';
  if (avgSpeedKmh < 80) return 'subway';
  return 'car';
}

/**
 * Update trip mode (user correction)
 */
export async function updateTripMode(req: any): Promise<TripResult> {
  const userId = req.headers['x-user-id'];
  const { tripId, newMode } = req.body;

  if (!tripId || !newMode) {
    const error: any = new Error("tripId and newMode are required");
    error.statusCode = 400;
    throw error;
  }

  const pgPool = getDatabase();

  // Get current trip data
  const tripResult = await pgPool.query(
    `SELECT * FROM trips WHERE id = $1 AND user_id = $2`,
    [tripId, userId]
  );

  if (tripResult.rows.length === 0) {
    const error: any = new Error("Trip not found");
    error.statusCode = 404;
    throw error;
  }

  const trip = tripResult.rows[0];
  const distanceKm = parseFloat(trip.distance_km);

  // Recalculate points and CO2
  const newPoints = Math.round(distanceKm * (POINTS_PER_KM[newMode] || 0));
  const newCo2Kg = (distanceKm * (EMISSION_FACTORS[newMode] || 0)) / 1000;
  const pointsDiff = newPoints - parseInt(trip.points);

  // Update trip
  await pgPool.query(
    `UPDATE trips SET mode = $2, points = $3, co2_kg = $4 WHERE id = $1`,
    [tripId, newMode, newPoints, newCo2Kg]
  );

  // Update user points
  if (pointsDiff !== 0) {
    await pgPool.query(
      `UPDATE users SET points_balance = points_balance + $2 WHERE id = $1`,
      [userId, pointsDiff]
    );
  }

  return {
    id: tripId,
    distance_km: distanceKm,
    co2_kg: newCo2Kg,
    points: newPoints,
    mode: newMode,
    duration_minutes: parseFloat(trip.duration_minutes)
  };
}

/**
 * Get user statistics
 */
export async function getUserStats(req: any): Promise<any> {
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  const pgPool = getDatabase();

  // Get user stats
  const userResult = await pgPool.query(
    `SELECT 
       points_balance,
       total_trips,
       total_distance_km,
       total_co2_saved_kg
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    const error: any = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const user = userResult.rows[0];

  // Get trip breakdown by mode
  const tripsByMode = await pgPool.query(
    `SELECT 
       mode,
       COUNT(*) as count,
       SUM(distance_km) as total_distance,
       SUM(points) as total_points
     FROM trips WHERE user_id = $1
     GROUP BY mode`,
    [userId]
  );

  // Get recent trips
  const recentTrips = await pgPool.query(
    `SELECT id, distance_km, points, mode, created_at
     FROM trips WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  return {
    pointsBalance: parseInt(user.points_balance) || 0,
    totalTrips: parseInt(user.total_trips) || 0,
    totalDistanceKm: parseFloat(user.total_distance_km) || 0,
    totalCO2SavedKg: parseFloat(user.total_co2_saved_kg) || 0,
    tripsByMode: tripsByMode.rows,
    recentTrips: recentTrips.rows
  };
}
