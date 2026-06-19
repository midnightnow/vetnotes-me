/**
 * Session Sync Endpoint
 *
 * Receives a Firebase ID token from the client and sets it as an
 * HttpOnly, Secure, SameSite=Strict cookie named __session.
 *
 * Called by src/lib/auth.ts on every Firebase onIdTokenChanged event.
 * This is the only place the __session cookie is written or cleared.
 *
 * POST { token: string | null }
 *   - token present → verify + set cookie (1 hour TTL)
 *   - token null    → clear cookie (sign-out)
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

// Ensure Admin SDK is initialized
if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

const SESSION_COOKIE_NAME = '__session';
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour — matches Firebase ID token lifetime

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);

  // Sign-out: clear the cookie
  if (!body?.token) {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    return json({ status: 'cleared' });
  }

  const { token } = body;

  // Verify the token is genuine before trusting it
  try {
    await getAuth().verifyIdToken(token);
  } catch {
    throw error(401, 'Invalid or expired Firebase ID token');
  }

  // Set HttpOnly cookie — not accessible to client JS
  cookies.set(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_SECONDS
  });

  return json({ status: 'ok' });
};
