// functions/src/get-id-token.ts
// Script to get an ID token for testing
// Run: npx ts-node src/get-id-token.ts
// Make sure emulators are running first: firebase emulators:start

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Initialize Firebase Admin
let app: admin.app.App;

// Try to use service account key if available, otherwise use default credentials
try {
  const serviceAccount = require('../../serviceAccountKey.json');
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'green-travel-app-90326'
  });
} catch (err) {
  // Initialize without explicit credentials (will use GOOGLE_APPLICATION_CREDENTIALS or defaults)
  app = admin.initializeApp({
    projectId: 'green-travel-app-90326'
  });
}

// Use emulator if available
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';

const auth = admin.auth();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function getIdToken() {
  try {
    console.log('\n=== Firebase ID Token Generator ===\n');
    console.log('This script generates an ID token for testing your Cloud Functions.\n');

    const email = await question('Enter user email: ');
    const password = await question('Enter user password: ');

    console.log('\nGenerating token...\n');

    // Create or get user
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log('✓ User found:', email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        console.log('Creating new user:', email);
        user = await auth.createUser({
          email,
          password,
          emailVerified: true
        });
        console.log('✓ User created with UID:', user.uid);
      } else {
        throw err;
      }
    }

    // Generate custom token (for use with emulator)
    const customToken = await auth.createCustomToken(user.uid);
    
    console.log('\n' + '='.repeat(60));
    console.log('Your Custom Token (for emulator testing):');
    console.log('='.repeat(60));
    console.log(customToken);
    console.log('='.repeat(60));
    
    console.log('\n📝 How to use this token:');
    console.log('1. In Firebase JS SDK (browser):');
    console.log('   firebase.auth().signInWithCustomToken(customToken)');
    console.log('\n2. For testing HTTP functions with Postman:');
    console.log('   Header: Authorization: Bearer <custom-token>');
    console.log('\n3. First sign in with email/password on the emulator UI:');
    console.log('   http://127.0.0.1:4001/auth');
    console.log('\nThen in browser console, get the ID token:');
    console.log('   firebase.auth().currentUser.getIdToken(true).then(token => console.log(token))');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

getIdToken();
