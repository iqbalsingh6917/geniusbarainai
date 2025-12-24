import { Request } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middleware/auth';

// Audit log parameters
export interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string | number;
  meta?: any;
}

// Function to log audit events
export async function logAudit(req: Request, params: AuditLogParams): Promise<void> {
  try {
    // Extract user info from auth context if available
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const orgUnitId = authReq.user?.orgUnitId;

    // Extract IP address (try multiple sources)
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.ip ||
      null;

    // Extract user agent
    const userAgent = req.headers['user-agent'] as string || null;

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        orgUnitId: orgUnitId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        meta: params.meta ? JSON.parse(JSON.stringify(params.meta)) : null,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    // Log the error but don't throw - we don't want audit logging to break the main request
    console.error('Failed to log audit event:', error);
  }
}
