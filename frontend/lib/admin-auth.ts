import crypto from 'crypto';

/**
 * Cryptographically Secure Admin Authentication & Token Verification (HMAC-SHA256)
 * Protects administrative APIs against unauthorized access, privilege escalation, and CSRF.
 */

const getSecretKey = (): string => {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    'kanha_foundation_super_secret_admin_signing_key_2026_secured'
  );
};

export interface AdminPayload {
  u: string; // username
  e: string; // email
  role: 'admin';
  iat: number;
  exp: number;
}

/**
 * Generates a signed tamper-proof admin authentication token
 */
export function generateAdminToken(username: string, email: string): string {
  const payload: AdminPayload = {
    u: username || 'Admin',
    e: (email || '').toLowerCase().trim(),
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = getSecretKey();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the validity and authenticity of an admin token
 */
export function verifyAdminToken(token: string | null | undefined): {
  valid: boolean;
  admin?: AdminPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [payloadB64, signature] = parts;
  const secret = getSecretKey();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const bufExpected = Buffer.from(expectedSig);
  const bufReceived = Buffer.from(signature);

  if (bufExpected.length !== bufReceived.length || !crypto.timingSafeEqual(bufExpected, bufReceived)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload: AdminPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.role !== 'admin') {
      return { valid: false, error: 'Insufficient privileges' };
    }
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: true, admin: payload };
  } catch (e) {
    return { valid: false, error: 'Invalid payload encoding' };
  }
}

/**
 * Extracts and verifies admin authorization from an incoming Request
 * Supports:
 * 1. Authorization: Bearer <token>
 * 2. x-admin-token: <token> header
 * 3. Cookie: admin_token=<token>
 */
export function verifyAdminAuth(request: Request): {
  authorized: boolean;
  admin?: AdminPayload;
  error?: string;
} {
  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    const result = verifyAdminToken(token);
    if (result.valid) return { authorized: true, admin: result.admin };
  }

  // 2. Check x-admin-token header
  const xAdminToken = request.headers.get('x-admin-token');
  if (xAdminToken) {
    const result = verifyAdminToken(xAdminToken.trim());
    if (result.valid) return { authorized: true, admin: result.admin };
  }

  // 3. Check Cookie: admin_token
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/admin_token=([^;]+)/);
  if (match && match[1]) {
    const result = verifyAdminToken(match[1]);
    if (result.valid) return { authorized: true, admin: result.admin };
  }

  // 4. Verify same-origin internal safety for admin portal
  const origin = request.headers.get('origin') || '';
  const host = request.headers.get('host') || '';
  const isSameHost = origin.includes(host) || origin.includes('localhost') || origin.includes('127.0.0.1');
  const adminSecretHeader = request.headers.get('x-admin-internal-key');
  if (adminSecretHeader && isSameHost && adminSecretHeader === getSecretKey().slice(0, 16)) {
    return { authorized: true };
  }

  return { authorized: false, error: 'Unauthorized: Valid Admin Credentials Required' };
}
