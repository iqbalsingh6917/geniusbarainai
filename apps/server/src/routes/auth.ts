import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prismaClient';
import config from '../config';
import { sendPasswordResetEmail } from '../services/emailService';
import { ok, fail } from '../utils/apiResponse';
import { rateLimiter } from '../middleware/rateLimit';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import { loginSchema, forgotPasswordSchema, resetPasswordValidationSchema, resetPasswordSchema } from '../schemas/authSchema';

const router = Router();

// Apply rate limiting to auth routes
router.use('/login', rateLimiter);
router.use('/forgot-password', rateLimiter);
router.use('/reset-password', rateLimiter);
const RESET_TOKEN_EXPIRY_HOURS = 1;

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
    orgUnitId: number | null;
    studentId: number | null;
  };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('Login request received:', req.body);
    
    // Check if body exists and is parsed correctly
    if (!req.body) {
      console.error('No body in request');
      return fail(res, 400, 'BAD_REQUEST', 'No request body');
    }
    
    // Validate input
    const validatedData = loginSchema.parse(req.body);
    
    const { username, password } = validatedData;
    
    console.log('Username:', username);
    console.log('Password:', password ? '[PROVIDED]' : '[MISSING]');
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      console.log('User not found');
      // Log failed login attempt
      await logAudit(req, {
        action: 'LOGIN_FAILED',
        entityType: 'User',
        meta: { username, reason: 'USER_NOT_FOUND' }
      });
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      // Log failed login attempt
      await logAudit(req, {
        action: 'LOGIN_FAILED',
        entityType: 'User',
        meta: { username, reason: 'INVALID_PASSWORD' }
      });
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role,
        orgUnitId: user.orgUnitId ?? null,
        studentId: (user as any).studentId ?? null,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    const response: LoginResponse = {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        orgUnitId: user.orgUnitId ?? null,
        studentId: (user as any).studentId ?? null,
      },
    };
    
    console.log('Login successful for user:', username);
    // Log successful login
    await logAudit(req, {
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      meta: { username }
    });
    ok(res, response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', err.errors);
    }
    console.error('Login error:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body);
    
    const { username } = validatedData;

    // Always return success to prevent username enumeration
    const response = { success: true };

    if (!username) {
      return ok(res, response);
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    // If user doesn't exist, still return success
    if (!user) {
      // Log password reset attempt for non-existent user
      await logAudit(req, {
        action: 'PASSWORD_RESET_ATTEMPT',
        entityType: 'User',
        meta: { username, reason: 'USER_NOT_FOUND' }
      });
      return ok(res, response);
    }

    // Clean up expired tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create password reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Build reset link
    const resetLink = `${config.frontendUrl}/reset-password/${token}`;

    // Send password reset email
    await sendPasswordResetEmail(user.username, user.username, resetLink);
    
    // Log password reset request
    await logAudit(req, {
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      meta: { username }
    });

    ok(res, response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', err.errors);
    }
    console.error('Forgot password error:', err);
    // Still return success to prevent enumeration
    ok(res, { success: true });
  }
});

// GET /api/auth/reset-password/:token (validation)
router.get('/reset-password/:token', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedParams = resetPasswordValidationSchema.parse(req.params);
    
    const { token } = validatedParams;

    // Find the password reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Check if token exists, is not expired, and is not used
    if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
      // Log invalid token validation attempt
      await logAudit(req, {
        action: 'PASSWORD_RESET_VALIDATION_FAILED',
        entityType: 'PasswordResetToken',
        meta: { token, reason: 'INVALID_OR_EXPIRED_TOKEN' }
      });
      return ok(res, { valid: false });
    }
    
    // Log valid token validation
    await logAudit(req, {
      action: 'PASSWORD_RESET_VALIDATION_SUCCESS',
      entityType: 'PasswordResetToken',
      entityId: resetToken.id,
      meta: { username: resetToken.user.username }
    });

    ok(res, { valid: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', err.errors);
    }
    console.error('Reset password validation error:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body);
    
    const { token, newPassword } = validatedData;

    // Check password strength (at least 8 characters)
    if (newPassword.length < 8) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters long');
    }

    // Find the password reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Check if token exists, is not expired, and is not used
    if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
      // Log invalid token usage attempt
      await logAudit(req, {
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'PasswordResetToken',
        meta: { token, reason: 'INVALID_OR_EXPIRED_TOKEN' }
      });
      return fail(res, 400, 'INVALID_TOKEN', 'Invalid or expired token');
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Optionally invalidate other tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    
    // Log successful password reset
    await logAudit(req, {
      action: 'PASSWORD_RESET_SUCCESS',
      entityType: 'User',
      entityId: resetToken.userId,
      meta: { username: resetToken.user.username }
    });

    ok(res, { success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', err.errors);
    }
    console.error('Reset password error:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
