import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

// Note: In a real production environment, you should use a service account.
// For this setup, we assume we are running in an environment with default credentials
// (like Cloud Functions/Run) or we accept that it might need configured credentials.

if (getApps().length === 0) {
  // If we had a service account JSON, we would use it here.
  // const serviceAccount = require('./path/to/serviceAccountKey.json');

  // Checking for environment variables that might contain credentials
  // If running locally with emulators, this works without creds.
  // If running in production GCP, it uses ADC (Application Default Credentials).
  initializeApp({
    // credential: cert(serviceAccount) // Uncomment if using a service account file
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  });
}

export const adminDb = getFirestore();
