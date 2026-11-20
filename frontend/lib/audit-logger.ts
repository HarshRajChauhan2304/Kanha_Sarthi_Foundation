import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';
import { supabaseAdmin } from '@/lib/supabase';

export type AuditEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_PASSWORD_CHANGE'
  | 'AUTH_LOCKOUT'
  | 'RBAC_ROLE_CHANGE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'VOLUNTEER_REGISTER'
  | 'VOLUNTEER_APPROVE'
  | 'VOLUNTEER_REJECT'
  | 'VOLUNTEER_UPDATE'
  | 'VOLUNTEER_DELETE'
  | 'DONATION_MUTATION'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'ADMIN_OPERATION';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  severity: AuditSeverity;
  actor_email: string;
  actor_role: string;
  ip_address: string;
  action: string;
  details: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
}

/**
 * Strips sensitive data like passwords, tokens, secret keys from audit log payloads
 */
function sanitizeDetails(details: any): Record<string, any> {
  if (!details || typeof details !== 'object') {
    return { info: String(details || '') };
  }

  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('key') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('card')
    ) {
      safe[key] = '[REDACTED_CONFIDENTIAL]';
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = sanitizeDetails(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Records a security audit log event resiliently across Supabase and local file storage
 */
export async function logAuditEvent({
  eventType,
  severity = 'info',
  actorEmail = 'anonymous',
  actorRole = 'user',
  ipAddress = '127.0.0.1',
  action,
  details = {},
  status = 'SUCCESS',
}: {
  eventType: AuditEventType;
  severity?: AuditSeverity;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  action: string;
  details?: Record<string, any> | string;
  status?: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
}): Promise<AuditLogEntry> {
  const timestamp = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const entry: AuditLogEntry = {
    id,
    timestamp,
    event_type: eventType,
    severity,
    actor_email: (actorEmail || 'anonymous').toLowerCase().trim(),
    actor_role: actorRole || 'anonymous',
    ip_address: ipAddress || '127.0.0.1',
    action,
    details: sanitizeDetails(details),
    status,
  };

  // 1. Write resiliently to local fallback audit_logs.json (capped to last 1000 entries)
  try {
    const filePath = getFallbackPath('audit_logs.json');
    let logs: AuditLogEntry[] = [];
    if (fs.existsSync(filePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        logs = [];
      }
    }

    logs.unshift(entry); // newest first
    if (logs.length > 1000) {
      logs = logs.slice(0, 1000);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (fileErr: any) {
    console.error('Failed to write audit log to local JSON:', fileErr.message);
  }

  // 2. Insert into Supabase audit_logs table asynchronously
  (async () => {
    try {
      await supabaseAdmin.from('audit_logs').insert([
        {
          id: entry.id,
          timestamp: entry.timestamp,
          event_type: entry.event_type,
          severity: entry.severity,
          actor_email: entry.actor_email,
          actor_role: entry.actor_role,
          ip_address: entry.ip_address,
          action: entry.action,
          details: entry.details,
          status: entry.status,
        },
      ]);
    } catch (dbErr) {
      // Supabase table may not exist yet or connection failed - fallback file already recorded it
    }
  })();

  return entry;
}

/**
 * Retrieves audit logs for authorized admin review
 */
export async function getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  // 1. Try reading from Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {}

  // 2. Fall back to local file
  try {
    const filePath = getFallbackPath('audit_logs.json');
    if (fs.existsSync(filePath)) {
      const logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(logs) ? logs.slice(0, limit) : [];
    }
  } catch (e) {}

  return [];
}
