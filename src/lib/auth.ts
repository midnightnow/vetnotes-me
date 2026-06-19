import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Initializes the global authentication observer.
 * Synchronizes the Firebase ID token with SvelteKit's __session cookie via server endpoint.
 */
export function initAuthListener() {
  return onIdTokenChanged(auth, async (user: User | null) => {
    if (user) {
      // 1. Force refresh of the token to guarantee it is current
      const token = await user.getIdToken(true);
      
      // 2. Send token to server to set HttpOnly cookie
      await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
      });
    } else {
      // 3. Clear the cookie immediately on sign-out via server
      await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: null })
      });
    }
  });
}
