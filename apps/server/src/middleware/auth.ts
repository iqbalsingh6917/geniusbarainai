import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';
import config from '../config';
import { AuthUser } from '../types/auth';
import { fail } from '../utils/apiResponse';

interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  orgUnitId?: number | null;
  studentId?: number | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Middleware to verify JWT token
export const authRequired = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      
      // Fetch user from database to ensure they still exist and get orgUnitId using raw query
      const userResult: any = await prisma.$queryRaw`
        SELECT "id", "username", "role", "orgUnitId", "studentId" FROM "User" WHERE "id" = ${decoded.userId}
      `;
      
      if (userResult.length === 0) {
        return fail(res, 401, 'AUTHENTICATION_ERROR', 'User not found');
      }
      
      const user = userResult[0];
      
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        orgUnitId: user.orgUnitId,
        studentId: user.studentId ?? null,
      };
      
      next();
    } catch (err) {
      return fail(res, 401, 'INVALID_TOKEN', 'Invalid token');
    }
  } catch (err) {
    return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

// Middleware to ensure user is a SUPERADMIN
export const superadminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return fail(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }

  if (req.user.role !== 'SUPERADMIN') {
    if (process.env.NODE_ENV === 'test') {
      console.warn('superadminOnly blocked request', {
        path: req.path,
        originalUrl: req.originalUrl,
        user: req.user,
      });
    }
    return fail(res, 403, 'ACCESS_DENIED', 'Access denied. Superadmin only.');
  }

  next();
};

// Alias for routes that import requireAuth
export const requireAuth = authRequired;
