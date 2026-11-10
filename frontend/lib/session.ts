/**
 * Universal Client-Side Session & Auto-Logout Manager
 * 
 * Automatically expires and cleans up sessions after:
 * 1. Inactivity Timeout: 10 minutes of no user interaction (clicks, scrolls, keypresses)
 * 2. Max Session Lifetime: 24 hours absolute maximum from login time
 */

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export type SessionRole = 'user' | 'admin' | 'volunteer';

let lastTouchTime = 0;

/**
 * Creates a new active session with timestamps
 */
export function createSession(role: SessionRole, userData?: any) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  localStorage.setItem('session_created_at', String(now));
  localStorage.setItem('session_last_active', String(now));
  localStorage.setItem('session_role', role);

  if (role === 'admin') {
    localStorage.setItem('admin_auth', 'true');
    if (userData?.username) localStorage.setItem('admin_username', userData.username);
    if (userData?.email) localStorage.setItem('admin_email', userData.email);
    if (userData?.avatar) localStorage.setItem('admin_avatar', userData.avatar);
    if (userData?.phone) localStorage.setItem('admin_phone', userData.phone);
  } else if (role === 'volunteer') {
    localStorage.setItem('volunteer_session', JSON.stringify(userData || {}));
  } else {
    localStorage.setItem('auth', 'true');
    if (userData?.username) localStorage.setItem('user_name', userData.username);
    if (userData?.email) localStorage.setItem('user_email', userData.email);
    if (userData?.phone) localStorage.setItem('user_phone', userData.phone || '');
    if (userData?.gender) localStorage.setItem('user_gender', userData.gender || '');
    if (userData?.dob) localStorage.setItem('user_dob', userData.dob || '');
    if (userData?.avatar) localStorage.setItem('user_avatar', userData.avatar || '');
    if (userData?.bio) localStorage.setItem('user_bio', userData.bio || '');
  }

  window.dispatchEvent(new Event('session_update'));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Updates the last active timestamp on user interaction (throttled to once every 30s)
 */
export function touchSession() {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (now - lastTouchTime < 30000) return; // throttle 30 seconds
  lastTouchTime = now;

  const createdAt = localStorage.getItem('session_created_at');
  if (!createdAt) return;

  localStorage.setItem('session_last_active', String(now));
}

/**
 * Checks if the current session has expired due to inactivity or max duration.
 * If expired, automatically clears the session and returns true.
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;

  const userAuth = localStorage.getItem('auth') === 'true';
  const adminAuth = localStorage.getItem('admin_auth') === 'true';
  const volSession = !!localStorage.getItem('volunteer_session');

  // If no one is logged in, session is not expired
  if (!userAuth && !adminAuth && !volSession) {
    return false;
  }

  const now = Date.now();
  const createdAtStr = localStorage.getItem('session_created_at');
  const lastActiveStr = localStorage.getItem('session_last_active');

  // If session keys exist but tracking timestamp was never set (legacy session), initialize it now
  if (!createdAtStr || !lastActiveStr) {
    localStorage.setItem('session_created_at', String(now));
    localStorage.setItem('session_last_active', String(now));
    return false;
  }

  const createdAt = parseInt(createdAtStr, 10);
  const lastActive = parseInt(lastActiveStr, 10);

  // Check 1: Inactivity timeout (e.g. 10 minutes without touch)
  const isIdleExpired = now - lastActive > INACTIVITY_TIMEOUT_MS;

  // Check 2: Absolute lifetime expiration (e.g. 24 hours max)
  const isLifetimeExpired = now - createdAt > MAX_SESSION_LIFETIME_MS;

  if (isIdleExpired || isLifetimeExpired) {
    clearAllSessions();
    return true;
  }

  return false;
}

/**
 * Returns true if an active, non-expired session exists
 */
export function hasActiveSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSessionExpired()) return false;

  const userAuth = localStorage.getItem('auth') === 'true';
  const adminAuth = localStorage.getItem('admin_auth') === 'true';
  const volSession = !!localStorage.getItem('volunteer_session');

  return userAuth || adminAuth || volSession;
}

/**
 * Returns the current active session role, or null
 */
export function getActiveSessionRole(): SessionRole | null {
  if (!hasActiveSession()) return null;
  const role = localStorage.getItem('session_role') as SessionRole;
  if (role) return role;

  if (localStorage.getItem('admin_auth') === 'true') return 'admin';
  if (localStorage.getItem('volunteer_session')) return 'volunteer';
  if (localStorage.getItem('auth') === 'true') return 'user';
  return null;
}

/**
 * Clears all user, admin, and volunteer credentials and session metadata
 */
export function clearAllSessions() {
  if (typeof window === 'undefined') return;

  // Clear session tracking
  localStorage.removeItem('session_created_at');
  localStorage.removeItem('session_last_active');
  localStorage.removeItem('session_role');

  // Clear user auth
  localStorage.removeItem('auth');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_phone');
  localStorage.removeItem('user_gender');
  localStorage.removeItem('user_dob');
  localStorage.removeItem('user_avatar');
  localStorage.removeItem('user_bio');

  // Clear admin auth
  localStorage.removeItem('admin_auth');
  localStorage.removeItem('admin_username');
  localStorage.removeItem('admin_email');
  localStorage.removeItem('admin_phone');
  localStorage.removeItem('admin_avatar');

  // Clear volunteer session
  localStorage.removeItem('volunteer_session');

  window.dispatchEvent(new Event('session_expired'));
  window.dispatchEvent(new Event('session_update'));
  window.dispatchEvent(new Event('storage'));
}

