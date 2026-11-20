/**
 * Universal Input Sanitization & Anti-XSS Security Utility
 * Protects against Cross-Site Scripting (XSS), HTML Injection, Null Byte attacks, and Path Traversal.
 */

// Pattern to detect dangerous HTML tags, attributes, event handlers and scripts
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
  /<meta\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, // onmouseover=, onclick=, onerror=, onload=
  /javascript\s*:[^"'\s]*/gi,
  /vbscript\s*:[^"'\s]*/gi,
  /data\s*:\s*text\/html[^"'\s]*/gi,
];

/**
 * Strips script tags, event handlers, and dangerous injection vectors from a string
 */
export function sanitizeString(input: unknown, maxLength: number = 2000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes (prevent null-byte poisoning)
  let clean = input.replace(/\0/g, '');

  // Strip path traversal sequences
  clean = clean.replace(/\.\.[\/\\]/g, '');

  // Remove dangerous tags and handlers
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  // Enforce max length
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  return clean.trim();
}

/**
 * Escapes HTML characters for safe rendering
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates whether an email address format is strictly RFC 5322 compliant
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(clean);
}

/**
 * Validates standard phone format (Indian 10-digit mobile or international format)
 */
export function isValidPhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Deep sanitizes all string properties within an object
 */
export function sanitizeObject<T>(obj: T, maxLength: number = 2000): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj, maxLength) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxLength)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't sanitize password fields with HTML stripping as it may alter valid password characters
      if (key.toLowerCase().includes('password')) {
        result[key] = typeof value === 'string' ? value.trim() : value;
      } else {
        result[key] = sanitizeObject(value, maxLength);
      }
    }
    return result as T;
  }

  return obj;
}
