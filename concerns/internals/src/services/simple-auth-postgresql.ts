// functions/src/services/simple-auth.ts
// Simplified authentication - username/password only using PostgreSQL
// No tokens, just username-based identification

import { 
  getUserByUsername,
  getUserById,
  createOrUpdateUser,
  updateUserPoints,
  getDatabase
} from './database';

export interface SimpleLoginRequest {
  username: string;
  password: string;
}

export interface SimpleLoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    pointsBalance: number;
  };
}

// PostgreSQL User Interface
export interface StoredUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: string;
  created_at: string;
  points_balance: number;
  total_trips: number;
  total_distance_km: number;
  total_co2_saved_kg: number;
  is_active: boolean;
  last_login: string | null;
}

/**
 * Simple password hashing (for demo - use bcrypt in production)
 * 
 * IMPORTANT: In production, replace with:
 * npm install bcrypt
 * import * as bcrypt from 'bcrypt';
 * return bcrypt.hashSync(password, 10);
 */
function hashPassword(password: string): string {
  // For demo purposes only
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Register a new user with username and password
 * Stores user in PostgreSQL database
 */
export async function simpleRegister(
  username: string,
  password: string,
  email: string,
  displayName: string
): Promise<SimpleLoginResponse> {
  try {
    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return {
        success: false,
        message: 'Username already exists'
      };
    }

    // Check if email already exists
    const db = getDatabase();
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (emailCheck.rows.length > 0) {
      return {
        success: false,
        message: 'Email already registered'
      };
    }

    // Create user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    // Create user in PostgreSQL
    const userData = {
      id: userId,
      username,
      email,
      displayName,
      passwordHash,
      role: 'user',
      pointsBalance: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      totalCO2SavedKg: 0,
      isActive: true,
      createdAt: now,
      lastLogin: null
    };

    await createOrUpdateUser(userId, userData);

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        displayName,
        role: 'user',
        pointsBalance: 0
      }
    };
  } catch (error: any) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: `Registration failed: ${error.message}`
    };
  }
}

/**
 * Login user with username and password
 * Returns user data if successful
 */
export async function simpleLogin(
  username: string,
  password: string
): Promise<SimpleLoginResponse> {
  try {
    // Find user by username in PostgreSQL
    const user = await getUserByUsername(username);

    if (!user) {
      return {
        success: false,
        message: 'Username or password incorrect'
      };
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return {
        success: false,
        message: 'Username or password incorrect'
      };
    }

    // Update last login
    try {
      const db = getDatabase();
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
    } catch (updateError) {
      console.warn('Failed to update last login:', updateError);
      // Don't fail login if we can't update last_login
    }

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        pointsBalance: user.points_balance
      }
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      message: `Login failed: ${error.message}`
    };
  }
}

/**
 * Get user by username (no password check)
 * Used for profile retrieval and user verification
 */
export async function getUserByUsernamePublic(username: string): Promise<any | null> {
  try {
    const user = await getUserByUsername(username);
    
    if (!user) {
      return null;
    }

    // Return public user data (without password hash)
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      pointsBalance: user.points_balance,
      totalTrips: user.total_trips,
      totalDistanceKm: user.total_distance_km,
      totalCO2SavedKg: user.total_co2_saved_kg,
      isActive: user.is_active,
      createdAt: user.created_at
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Get user by ID
 * Used for internal lookups
 */
export async function getUserByIdInternal(userId: string): Promise<StoredUser | null> {
  try {
    return await getUserById(userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Verify username exists
 */
export async function verifyUsername(username: string): Promise<boolean> {
  try {
    const user = await getUserByUsername(username);
    return user !== null;
  } catch (error) {
    console.error('Error verifying username:', error);
    return false;
  }
}

/**
 * Get user profile (public data)
 */
export async function getUserProfile(userId: string): Promise<any | null> {
  try {
    const user = await getUserById(userId);
    
    if (!user) {
      return null;
    }

    // Return public user data
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      pointsBalance: user.points_balance,
      totalTrips: user.total_trips,
      totalDistanceKm: user.total_distance_km,
      totalCO2SavedKg: user.total_co2_saved_kg,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Update user points
 */
export async function addUserPoints(userId: string, points: number): Promise<void> {
  try {
    await updateUserPoints(userId, points);
  } catch (error) {
    console.error('Error updating user points:', error);
    throw error;
  }
}

/**
 * Initialize a new user (creates in PostgreSQL)
 */
export async function initializeUser(
  userId: string,
  username: string,
  email: string,
  displayName: string
): Promise<void> {
  try {
    const userData = {
      id: userId,
      username,
      email,
      displayName,
      passwordHash: hashPassword('default'), // Will be updated by user
      role: 'user',
      pointsBalance: 100, // Welcome bonus
      totalTrips: 0,
      totalDistanceKm: 0,
      totalCO2SavedKg: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    await createOrUpdateUser(userId, userData);
  } catch (error) {
    console.error('Error initializing user:', error);
    throw error;
  }
}
