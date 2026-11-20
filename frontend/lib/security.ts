import crypto from 'crypto';

/**
 * Hash a plain text password using PBKDF2 with a unique salt (SHA-512, 10,000 iterations).
 * Produces format: pbkdf2$<salt>$<hash>
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  // If already hashed, return as is to prevent double hashing
  if (password.startsWith('pbkdf2$')) {
    return password;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

/**
 * Verify a plain text password against a stored hash or legacy plain text string.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!password || !storedHashOrPlain) return false;

  // 1. Check if stored value is a PBKDF2 hash
  if (storedHashOrPlain.startsWith('pbkdf2$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const originalHash = parts[2];
      try {
        const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        const bufTest = Buffer.from(testHash, 'hex');
        const bufOriginal = Buffer.from(originalHash, 'hex');
        if (bufTest.length === bufOriginal.length) {
          return crypto.timingSafeEqual(bufTest, bufOriginal);
        }
      } catch (e) {
        return false;
      }
    }
  }

  // 2. Legacy fallback: plain text comparison for existing unmigrated accounts
  return storedHashOrPlain === password;
}

/**
 * Check if a stored password is already hashed
 */
export function isPasswordHashed(password: string): boolean {
  return typeof password === 'string' && password.startsWith('pbkdf2$');
}

/**
 * Strips password and sensitive credentials from an entity object before sending in response
 */
export function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): Omit<T, 'password'> | null {
  if (!user || typeof user !== 'object') return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Strips password and sensitive credentials from an array of user objects
 */
export function sanitizeUsers<T extends Record<string, any>>(users: T[] | null | undefined): Omit<T, 'password'>[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => {
    if (!u || typeof u !== 'object') return u;
    const { password, ...safeUser } = u;
    return safeUser;
  });
}
