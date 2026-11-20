import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { getAuditLogs, logAuditEvent } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAuth(request, ['admin']);
  if (!auth.authorized) {
    const clientIp = getClientIp(request);
    logAuditEvent({
      eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      severity: 'warning',
      actorEmail: 'unauthorized',
      actorRole: 'anonymous',
      ipAddress: clientIp,
      action: 'Attempted to access security audit logs without admin credentials',
      status: 'BLOCKED',
    });

    return NextResponse.json(
      { success: false, error: auth.error || 'Access denied: Administrator privileges required.' },
      { status: auth.status }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const logs = await getAuditLogs(limit);

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
