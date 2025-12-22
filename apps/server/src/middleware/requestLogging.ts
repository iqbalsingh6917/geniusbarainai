import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import { getRequestContext, runWithRequestContext } from '../utils/requestContext';

function generateRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerId = req.headers['x-request-id'];
  const requestId = headerId ? String(headerId) : generateRequestId();
  (req as any).requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  runWithRequestContext(requestId, () => next());
}

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const rawPath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.baseUrl || req.path;
    const path = rawPath.replace(/\/\d+(?=\/|$)/g, '/:id');
    const user = (req as any).user;
    const context = getRequestContext();
    logger.info('request', {
      requestId: res.locals.requestId,
      method: req.method,
      path,
      status: res.statusCode,
      duration_ms: Math.round(durationMs),
      queryCount: context?.counts.queryCount ?? 0,
      slowQueryCount: context?.counts.slowQueryCount ?? 0,
      role: user?.role ?? null,
      orgUnitId: user?.orgUnitId ?? null,
    });
  });
  next();
}
