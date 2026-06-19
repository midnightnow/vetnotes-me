import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  // Uses GOOGLE_APPLICATION_CREDENTIALS or Firebase Functions default service account
  initializeApp({
    credential: applicationDefault()
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
