/**
 * Firebase Configuration for VetNotes.me
 * Shares the VetSorcery production Firebase project for unified auth.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: 'vetsorcery.firebaseapp.com',
    projectId: 'vetsorcery',
    storageBucket: 'vetsorcery.firebasestorage.app',
    messagingSenderId: '104084744378',
    appId: '1:104084744378:web:b7096707bfd1520dc5fa83',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
    return signInWithPopup(auth, googleProvider);
}

export { app, auth, db, googleProvider };
