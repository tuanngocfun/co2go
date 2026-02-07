// functions/src/types/trip.ts

export interface GPSPoint {
  lat: number;
  lng: number;
  ts: Date | string | any;
}

export interface TripRequest {
  gpsPoints: GPSPoint[];
  localDistanceMeters?: number;
  startedAt?: Date | string | any;
  stoppedAt?: Date | string | any;
}

export interface TripResult {
  tripId: string;
  mode: string;
  modeProb: number;
  distance_m: number;
  distance_km: number;
  co2_kg: number;
  points: number;
}

export type TransportMode = 'bike' | 'walk' | 'bus' | 'motorcycle' | 'car';

export type TripStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Trip {
  userId: string;
  startedAt: any;
  stoppedAt: any;
  route: GPSPoint[];
  distance_m: number;
  mode: TransportMode;
  modeProb: number;
  co2_kg: number;
  points: number;
  status: TripStatus;
  autoStopped: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface User {
  email: string;
  displayName: string;
  photoURL?: string;
  pointsBalance: number;
  fcmToken?: string;
  createdAt: any;
  lastSeen: any;
  lastUpdated?: any;
}

export interface Voucher {
  code: string;
  title: string;
  costPoints: number;
  partner: string;
  validFrom: any;
  validTo: any;
  stock?: number;
  active: boolean;
  createdAt?: any;
}

export interface Redemption {
  userId: string;
  voucherId: string;
  pointsSpent: number;
  txBlockchain?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: any;
}

export interface UserStats {
  totalTrips: number;
  totalDistanceKm: number;
  totalCO2SavedKg: number;
  modeDistribution: Record<string, number>;
}

export interface DailyStats {
  date: string;
  totalTrips: number;
  totalDistance: number;
  totalCO2: number;
  totalPoints: number;
  modeBreakdown: Record<string, number>;
}

export const EMISSION_FACTORS: Record<TransportMode, number> = {
  bike: 0,
  walk: 0,
  bus: 130,
  motorcycle: 100,
  car: 180
};

export const POINTS_PER_KM: Record<TransportMode, number> = {
  bike: 2,
  walk: 2,
  bus: 1,
  motorcycle: -1,
  car: -2
};

export const AUTO_STOP_CONFIG = {
  durationMinutes: 5,
  minDistanceMeters: 50
};

export const VALIDATION = {
  minGPSPoints: 2,
  maxGPSPoints: 10000,
  minTripDistanceMeters: 10,
  maxTripDistanceMeters: 500000,
  maxSpeedKmh: 200
};

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
}

export function createApiError(message: string, statusCode: number = 500): ApiError {
  return {
    message,
    statusCode
  };
}