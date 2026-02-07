// functions/src/services/auth-service.ts
import * as admin from "firebase-admin";
import { getDatabase } from "./database";

const getDb = () => admin.firestore();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export interface UserClaims {
  role: UserRole;
  permissions: string[];
  isVerified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: {
    deviceType: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
  };
}

export interface LoginResponse {
  success: boolean;
  user: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    permissions: string[];
    photoURL?: string;
    isVerified: boolean;
  };
  tokens: {
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  profile?: {
    pointsBalance: number;
    totalTrips: number;
    totalDistanceKm: number;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
}

// ============================================================================
// PERMISSIONS CONFIGURATION
// ============================================================================

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'users.read',
    'users.write',
    'users.delete',
    'trips.read',
    'trips.write',
    'trips.delete',
    'vouchers.read',
    'vouchers.write',
    'vouchers.delete',
    'redemptions.read',
    'redemptions.write',
    'stats.read',
    'audit.read',
    'admin.access'
  ],
  [UserRole.MODERATOR]: [
    'users.read',
    'trips.read',
    'trips.write',
    'vouchers.read',
    'vouchers.write',
    'redemptions.read',
    'stats.read'
  ],
  [UserRole.USER]: [
    'profile.read',
    'profile.write',
    'trips.create',
    'trips.read.own',
    'vouchers.read',
    'redemptions.create',
    'redemptions.read.own'
  ]
};

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Register new user
 */
export async function registerUser(request: RegisterRequest): Promise<LoginResponse> {
  const db = getDb();

  try {
    // 1. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: request.email,
      password: request.password,
      displayName: request.displayName,
      emailVerified: false
    });

    // 2. Set default role as USER
    const role = UserRole.USER;
    const permissions = ROLE_PERMISSIONS[role];

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role,
      permissions,
      isVerified: false
    });

    // 3. Create Firestore user document
    await db.collection('users').doc(userRecord.uid).set({
      email: request.email,
      displayName: request.displayName,
      phoneNumber: request.phoneNumber || null,
      photoURL: null,
      role,
      permissions,
      pointsBalance: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      totalCO2SavedKg: 0,
      isActive: true,
      isVerified: false,
      accountStatus: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Create PostgreSQL user record
    await syncUserToPostgres(userRecord.uid, {
      email: request.email,
      displayName: request.displayName,
      role
    });

    // 5. Generate custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // 6. Send verification email
    await sendVerificationEmail(userRecord.uid, request.email);

    return {
      success: true,
      user: {
        uid: userRecord.uid,
        email: request.email,
        displayName: request.displayName,
        role,
        permissions,
        isVerified: false
      },
      tokens: {
        idToken: customToken,
        refreshToken: '', // Client will get this from Firebase SDK
        expiresIn: 3600
      }
    };

  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(`Registration failed: ${error.message}`);
  }
}

/**
 * Login user with email/password
 */
export async function loginUser(request: LoginRequest): Promise<LoginResponse> {
  const db = getDb();

  try {
    // 1. Get user by email
    const userRecord = await admin.auth().getUserByEmail(request.email);

    // 2. Get user document from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User profile not found');
    }

    const userData = userDoc.data()!;

    // 3. Check if user is active
    if (!userData.isActive || userData.accountStatus === 'suspended') {
      throw new Error('Account is suspended or inactive');
    }

    // 4. Get custom claims
    const user = await admin.auth().getUser(userRecord.uid);
    const claims = user.customClaims as UserClaims || {
      role: UserRole.USER,
      permissions: ROLE_PERMISSIONS[UserRole.USER],
      isVerified: false
    };

    // 5. Update last seen
    await db.collection('users').doc(userRecord.uid).update({
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 6. Log session
    if (request.deviceInfo) {
      await logUserSession(userRecord.uid, request.deviceInfo);
    }

    // 7. Create custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid, claims);

    // 8. Get user profile stats
    const profile = {
      pointsBalance: userData.pointsBalance || 0,
      totalTrips: userData.totalTrips || 0,
      totalDistanceKm: userData.totalDistanceKm || 0
    };

    return {
      success: true,
      user: {
        uid: userRecord.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: claims.role,
        permissions: claims.permissions,
        photoURL: userData.photoURL,
        isVerified: claims.isVerified
      },
      tokens: {
        idToken: customToken,
        refreshToken: '', // Client SDK handles this
        expiresIn: 3600
      },
      profile
    };

  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/user-not-found') {
      throw new Error('Invalid email or password');
    }
    
    throw new Error(`Login failed: ${error.message}`);
  }
}

/**
 * Verify user token and get user info
 */
export async function verifyToken(idToken: string): Promise<{
  uid: string;
  email: string;
  role: UserRole;
  permissions: string[];
}> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const claims = decodedToken as any;

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: claims.role || UserRole.USER,
      permissions: claims.permissions || ROLE_PERMISSIONS[UserRole.USER]
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Change user role (Admin only)
 */
export async function changeUserRole(
  adminUid: string,
  targetUserId: string,
  newRole: UserRole
): Promise<void> {
  const db = getDb();

  try {
    // 1. Verify admin has permission
    const adminUser = await admin.auth().getUser(adminUid);
    const adminClaims = adminUser.customClaims as UserClaims;

    if (adminClaims?.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Admin access required');
    }

    // 2. Update custom claims
    const permissions = ROLE_PERMISSIONS[newRole];
    await admin.auth().setCustomUserClaims(targetUserId, {
      role: newRole,
      permissions,
      isVerified: true
    });

    // 3. Update Firestore
    await db.collection('users').doc(targetUserId).update({
      role: newRole,
      permissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Log audit
    await logAuditAction({
      adminId: adminUid,
      action: 'CHANGE_USER_ROLE',
      targetUserId,
      oldRole: adminClaims.role,
      newRole,
      timestamp: new Date()
    });

    console.log(`User ${targetUserId} role changed to ${newRole} by admin ${adminUid}`);

  } catch (error: any) {
    console.error('Change role error:', error);
    throw error;
  }
}

/**
 * Create admin user (System function - use carefully)
 */
export async function createAdminUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const db = getDb();

  try {
    // 1. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });

    // 2. Set admin claims
    const role = UserRole.ADMIN;
    const permissions = ROLE_PERMISSIONS[role];

    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role,
      permissions,
      isVerified: true
    });

    // 3. Create Firestore document
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      permissions,
      pointsBalance: 0,
      isActive: true,
      isVerified: true,
      accountStatus: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Add to admins collection
    await db.collection('admins').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Admin user created: ${email}`);
    return userRecord.uid;

  } catch (error: any) {
    console.error('Create admin error:', error);
    throw error;
  }
}

/**
 * Check if user has permission
 */
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.includes(requiredPermission) || 
         userPermissions.includes('admin.access');
}

/**
 * Middleware to verify admin access
 */
export async function requireAdmin(idToken: string): Promise<void> {
  const decoded = await admin.auth().verifyIdToken(idToken);
  const claims = decoded as any;

  if (claims.role !== UserRole.ADMIN) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Middleware to verify specific permission
 */
export async function requirePermission(
  idToken: string,
  permission: string
): Promise<void> {
  const decoded = await admin.auth().verifyIdToken(idToken);
  const claims = decoded as any;
  const userPermissions = claims.permissions || [];

  if (!hasPermission(userPermissions, permission)) {
    throw new Error(`Unauthorized: Missing permission ${permission}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function syncUserToPostgres(userId: string, userData: any): Promise<void> {
  try {
    const pgPool = getDatabase();

    await pgPool.query(
      `INSERT INTO users (id, email, name, created_at, last_active)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, userData.email, userData.displayName]
    );
  } catch (error) {
    console.error('PostgreSQL sync error:', error);
  }
}

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  try {
    const actionCodeSettings = {
      url: `${process.env.APP_URL}/verify-email`,
      handleCodeInApp: true
    };

    const link = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
    
    // TODO: Send email via SendGrid/Mailgun
    console.log(`Verification email sent to ${email}: ${link}`);
  } catch (error) {
    console.error('Send verification email error:', error);
  }
}

async function logUserSession(userId: string, deviceInfo: any): Promise<void> {
  try {
    const pgPool = getDatabase();

    await pgPool.query(
      `INSERT INTO user_sessions (user_id, device_type, device_model, os_version, app_version, started_at, is_active)
       VALUES ($1, $2, $3, $4, $5, NOW(), TRUE)`,
      [
        userId,
        deviceInfo.deviceType,
        deviceInfo.deviceModel,
        deviceInfo.osVersion,
        deviceInfo.appVersion
      ]
    );
  } catch (error) {
    console.error('Log session error:', error);
  }
}

async function logAuditAction(data: any): Promise<void> {
  try {
    const pgPool = getDatabase();

    await pgPool.query(
      `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        data.adminId,
        data.action,
        'user',
        data.targetUserId,
        JSON.stringify({ oldRole: data.oldRole, newRole: data.newRole })
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}