// scripts/create-admin.ts
// Script to create first admin user
// Run: npx ts-node scripts/create-admin.ts
// Requires FIREBASE_SERVICE_ACCOUNT environment variable or serviceAccountKey.json file

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Initialize Firebase Admin
let serviceAccount: any;

// Try to load from serviceAccountKey.json file first
try {
  serviceAccount = require('../../serviceAccountKey.json');
} catch (err) {
  // Try environment variable if file doesn't exist
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!envVar) {
    console.error('❌ Error: serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT environment variable not set');
    console.error('\nTo use this script, you need to:');
    console.error('1. Download serviceAccountKey.json from Firebase Console (Project Settings > Service Accounts)');
    console.error('2. Place it in the project root directory');
    console.error('OR');
    console.error('3. Set the FIREBASE_SERVICE_ACCOUNT environment variable with the JSON content');
    process.exit(1);
  }
  serviceAccount = JSON.parse(envVar);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const getDb = () => admin.firestore();

enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'users.read', 'users.write', 'users.delete',
    'trips.read', 'trips.write', 'trips.delete',
    'vouchers.read', 'vouchers.write', 'vouchers.delete',
    'redemptions.read', 'redemptions.write',
    'stats.read', 'audit.read', 'admin.access'
  ],
  [UserRole.MODERATOR]: [
    'users.read', 'trips.read', 'trips.write',
    'vouchers.read', 'vouchers.write',
    'redemptions.read', 'stats.read'
  ],
  [UserRole.USER]: [
    'profile.read', 'profile.write',
    'trips.create', 'trips.read.own',
    'vouchers.read', 'redemptions.create', 'redemptions.read.own'
  ]
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function createAdminUser() {
  console.log('\n=== Create Admin User ===\n');

  try {
    // Get user input
    const email = await question('Admin Email: ');
    const password = await question('Admin Password (min 6 chars): ');
    const displayName = await question('Admin Display Name: ');

    // Validation
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (!displayName) {
      throw new Error('Display name is required');
    }

    // Confirm
    const confirm = await question(`\nCreate admin user with email "${email}"? (yes/no): `);
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      rl.close();
      process.exit(0);
    }

    console.log('\nCreating admin user...');

    // 1. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });

    console.log(`✓ Firebase Auth user created: ${userRecord.uid}`);

    // 2. Set admin custom claims
    const role = UserRole.ADMIN;
    const permissions = ROLE_PERMISSIONS[role];

    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role,
      permissions,
      isVerified: true
    });

    console.log(`✓ Admin claims set`);

    // 3. Create Firestore user document
    await getDb().collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      permissions,
      pointsBalance: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      totalCO2SavedKg: 0,
      isActive: true,
      isVerified: true,
      accountStatus: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✓ Firestore user document created`);

    // 4. Add to admins collection
    await getDb().collection('admins').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✓ Added to admins collection`);

    console.log('\n=== Admin User Created Successfully! ===');
    console.log(`Email: ${email}`);
    console.log(`UID: ${userRecord.uid}`);
    console.log(`Role: ${role}`);
    console.log('\nYou can now login with this account.\n');

  } catch (error: any) {
    console.error('\n❌ Error creating admin user:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.error('This email is already registered.');
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
createAdminUser();
