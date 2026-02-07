// functions/src/services/trip-processor.ts
import { GPSPoint, TripRequest, TripResult } from "../types/trip";
import { detectTransportMode } from "./ai-service";
import { 
  syncToPostgres,
  getUserById,
  updateUserPoints,
  getTripsForUser
} from "./database";

// Constants from project specifications
const EMISSION_FACTORS: Record<string, number> = {
  bike: 0,
  walk: 0,
  bus: 130,
  motorcycle: 100,
  car: 180
};

const POINTS_PER_KM: Record<string, number> = {
  bike: 2,
  walk: 2,
  bus: 1,
  motorcycle: -1,
  car: -2
};

/**
 * Process completed trip and calculate emissions/points
 */
export async function processTrip(req: any): Promise<TripResult> {
  // 1. Get user ID from header (username-based auth)
  const userId = req.headers['x-user-id'];
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  // 2. Parse and validate request body
  const { gpsPoints, localDistanceMeters, startedAt, stoppedAt }: TripRequest = req.body;

  if (!gpsPoints || !Array.isArray(gpsPoints) || gpsPoints.length < 2) {
    const error: any = new Error("Invalid GPS points data");
    error.statusCode = 400;
    throw error;
  }

  // 3. Detect transport mode using AI
  const { mode, probability } = await detectTransportMode(gpsPoints);

  // 4. Calculate distance
  const distance_m = localDistanceMeters || calculateDistance(gpsPoints);
  const distance_km = distance_m / 1000;

  // 5. Calculate CO2 emissions
  const emissionFactor = EMISSION_FACTORS[mode] || 0;
  const co2_kg = (emissionFactor * distance_km) / 1000;

  // 6. Calculate points
  const pointsPerKm = POINTS_PER_KM[mode] || 0;
  const points = Math.round(pointsPerKm * distance_km);

  // 7. Create trip data
  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tripData = {
    id: tripId,
    user_id: userId,
    start_ts: startedAt ? new Date(startedAt).getTime() : gpsPoints[0]?.ts || Date.now(),
    stop_ts: stoppedAt ? new Date(stoppedAt).getTime() : gpsPoints[gpsPoints.length - 1]?.ts || Date.now(),
    route: gpsPoints,
    distance_m: parseFloat(distance_m.toFixed(2)),
    distance_km: parseFloat(distance_km.toFixed(2)),
    mode,
    mode_prob: parseFloat(probability.toFixed(3)),
    co2_kg: parseFloat(co2_kg.toFixed(4)),
    points,
    status: "confirmed",
    auto_stopped: false
  };

  // 8. Save to PostgreSQL
  await syncToPostgres(tripId, tripData);

  // 9. Update user points
  await updateUserPoints(userId, points);

  // 10. Send push notification
  await sendTripNotification(userId, points, tripId, mode);

  // 11. Return result
  return {
    tripId,
    mode,
    modeProb: tripData.mode_prob,
    distance_m: tripData.distance_m,
    distance_km: tripData.distance_km,
    co2_kg: tripData.co2_kg,
    points
  };
}

/**
 * Update trip mode when user corrects the detection
 */
export async function updateTripMode(req: any): Promise<any> {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  const { tripId, newMode } = req.body;

  if (!tripId || !newMode || !EMISSION_FACTORS.hasOwnProperty(newMode)) {
    const error: any = new Error("Invalid tripId or mode");
    error.statusCode = 400;
    throw error;
  }

  // Get trip from PostgreSQL
  const trips = await getTripsForUser(userId);
  const trip = trips.find(t => t.id === tripId);

  if (!trip) {
    const error: any = new Error("Trip not found or unauthorized");
    error.statusCode = 403;
    throw error;
  }

  const distance_km = trip.distance_m / 1000;

  const newCO2 = (EMISSION_FACTORS[newMode] * distance_km) / 1000;
  const newPoints = Math.round((POINTS_PER_KM[newMode] || 0) * distance_km);
  const oldPoints = trip.points || 0;
  const pointsDiff = newPoints - oldPoints;

  // Update trip in PostgreSQL
  await syncToPostgres(tripId, {
    ...trip,
    mode: newMode,
    co2_kg: parseFloat(newCO2.toFixed(4)),
    points: newPoints
  });

  // Update user points
  await updateUserPoints(userId, pointsDiff);

  return {
    tripId,
    mode: newMode,
    co2_kg: parseFloat(newCO2.toFixed(4)),
    points: newPoints,
    pointsDiff
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

  const user = await getUserById(userId);
  if (!user) {
    const error: any = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const trips = await getTripsForUser(userId);
  const confirmedTrips = trips.filter(t => t.status === 'confirmed');

  let totalDistance = 0;
  let totalCO2Saved = 0;
  const modeCount: Record<string, number> = {};

  confirmedTrips.forEach(trip => {
    totalDistance += trip.distance_m || 0;
    
    if (['bike', 'walk', 'bus'].includes(trip.mode)) {
      const carCO2 = (EMISSION_FACTORS.car * (trip.distance_m / 1000)) / 1000;
      const actualCO2 = trip.co2_kg || 0;
      totalCO2Saved += (carCO2 - actualCO2);
    }
    
    modeCount[trip.mode] = (modeCount[trip.mode] || 0) + 1;
  });

  return {
    user: {
      displayName: user.display_name || 'User',
      email: user.email || '',
      pointsBalance: user.points_balance || 0
    },
    stats: {
      totalTrips: confirmedTrips.length,
      totalDistanceKm: parseFloat((totalDistance / 1000).toFixed(2)),
      totalCO2SavedKg: parseFloat(totalCO2Saved.toFixed(2)),
      modeDistribution: modeCount
    }
  };
}

function calculateDistance(gpsPoints: GPSPoint[]): number {
  if (!gpsPoints || gpsPoints.length < 2) return 0;

  let totalDistance = 0;
  const R = 6371000;

  for (let i = 1; i < gpsPoints.length; i++) {
    const prev = gpsPoints[i - 1];
    const curr = gpsPoints[i];

    const lat1 = prev.lat * Math.PI / 180;
    const lat2 = curr.lat * Math.PI / 180;
    const dLat = (curr.lat - prev.lat) * Math.PI / 180;
    const dLng = (curr.lng - prev.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }

  return totalDistance;
}

async function sendTripNotification(
  userId: string,
  points: number,
  tripId: string,
  mode: string
): Promise<void> {
  try {
    // Skip FCM notification for now - would need Firebase admin SDK
    // In a real deployment, fetch fcmToken from PostgreSQL users table
    const pointsText = points >= 0 ? `+${points}` : `${points}`;
    console.log(`Trip notification: User ${userId} earned ${pointsText} points via ${mode}`);
    console.log(`Trip ID: ${tripId}`);
  } catch (error) {
    console.error('Notification error:', error);
  }
}