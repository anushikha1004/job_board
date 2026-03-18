/**
 * Firebase Configuration and Initialization
 * Initialize Firestore client for job board
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Validate Firebase configuration
 */
const requiredFields = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const hasRequiredConfig = requiredFields.every((field) => Boolean(firebaseConfig[field]));

function validateFirebaseConfig(): void {
  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field]
  );

  if (missingFields.length > 0) {
    console.warn(
      `Missing Firebase configuration: ${missingFields.join(', ')}. 
       Please check your .env.local file.`
    );
  }
}

const isBrowser = typeof window !== 'undefined';

// Validate configuration only in the browser to avoid build-time failures in CI.
if (isBrowser) {
  validateFirebaseConfig();
}

let app: FirebaseApp = null as unknown as FirebaseApp;
let db: Firestore = null as unknown as Firestore;

if (isBrowser && hasRequiredConfig) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
}

export { db };
export default app;

export default app;
