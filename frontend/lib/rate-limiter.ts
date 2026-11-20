/**
 * High-Performance In-Memory Sliding Window Rate Limiter
 * Protects against brute-force password cracking, credential stuffing, DDoS, and API spam.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove timestamps older than 1 hour
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

/**
 * Extracts the real client IP from incoming request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  return '127.0.0.1';
}

/**
 * Sliding Window Rate Limit Checker
 * @param key Unique identifier (e.g. `auth:${ip}:${identifier}`)
 * @param maxAttempts Max allowed attempts within the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxAttempts) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterMs = oldestTimestamp + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Record this attempt
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxAttempts - record.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Specifically tracks failed login attempts.
 * Only call recordFailedLogin when credentials check fails.
 */
export function recordFailedAuth(key: string) {
  const now = Date.now();
  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }
  record.timestamps.push(now);
}

/**
 * Clears failed login counter upon successful authentication
 */
export function clearFailedAuth(key: string) {
  rateLimitStore.delete(key);
}

/**
 * Checks if client is currently locked out from auth attempts
 * Max 5 failed attempts per 15 minutes
 */
export function isAuthLocked(ip: string, identifier?: string): { locked: boolean; retryAfterSeconds: number } {
  const key = `auth_fail:${ip}:${identifier ? identifier.toLowerCase().trim() : 'general'}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes lockout
  const maxFailed = 5;

  let record = rateLimitStore.get(key);
  if (!record) return { locked: false, retryAfterSeconds: 0 };

  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxFailed) {
    const oldest = record.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  return { locked: false, retryAfterSeconds: 0 };
}
