/**
 * SvelteKit Server Hook — Firebase Auth Session Verification
 * 
 * Populates `event.locals.user` by verifying the Firebase ID token
 * from either:
 *   1. The `__session` cookie (set by the client after login)
 *   2. The `Authorization: Bearer <token>` header (for API calls)
 * 
 * If no valid token is found, locals.user remains undefined.
 * Individual routes decide whether to enforce auth (throw 401) or allow anonymous access.
 */
import type { Handle } from '@sveltejs/kit';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

export const handle: Handle = async ({ event, resolve }) => {
  // Ensure Firebase Admin is initialized
  if (getApps().length === 0) {
    try {
      initializeApp({ credential: applicationDefault() });
    } catch {
      // If credentials aren't available, skip auth verification
      return resolve(event);
    }
  }

  const adminAuth = getAuth();

  // Extract token from cookie or Authorization header
  const sessionCookie = event.cookies.get('__session');
  const authHeader = event.request.headers.get('authorization');
  const token = sessionCookie || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      event.locals.user = {
        uid: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || decoded.email || 'Veterinary Practitioner'
      };
    } catch {
      // Token expired or invalid — clear cookie if present
      if (sessionCookie) {
        event.cookies.delete('__session', { path: '/' });
      }
      event.locals.user = undefined;
    }
  }

  return resolve(event);
};
