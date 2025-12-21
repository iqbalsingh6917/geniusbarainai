import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import { createUserSchema, updateUserSchema, changePasswordSchema } from '../schemas/userSchema';

const router = Router();
const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// GET /api/superadmin/users
// Role: SUPERADMIN only
// Get all users with optional filters
router.get('/', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { orgUnitId, role } = req.query;

    // Build where clause based on filters
    const where: any = {};
    if (orgUnitId) {
      where.orgUnitId = parseInt(orgUnitId as string);
    }
    if (role) {
      where.role = role;
    }

    // Get users with org unit info
    const users = await prisma.user.findMany({
      where,
      include: {
        orgUnit: true
      },
      orderBy: [
        { role: 'asc' },
        { username: 'asc' }
      ]
    });

    // Map to response format
    const result = users.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      orgUnitId: user.orgUnitId,
      orgUnitCode: user.orgUnit?.code || null,
      orgUnitName: user.orgUnit?.name || null,
      isActive: (user as any).isActive !== undefined ? (user as any).isActive : true,
      createdAt: user.createdAt
    }));

    // Log audit
    await logAudit(req, {
      action: 'USER_LIST_VIEWED',
      entityType: 'User',
      meta: { filters: { orgUnitId, role } }
    });

    ok(res, result);
  } catch (error) {
    console.error('Error fetching users:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/superadmin/users
// Role: SUPERADMIN only
// Create a new user
router.post('/', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Validate input
    const validatedData = createUserSchema.parse(req.body);

    const { username, password, role, orgUnitId } = validatedData;

    // Validate role
    const validRoles = ['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'ADMISSIONS', 'TEACHER'];
    if (!validRoles.includes(role) && role !== 'SUPERADMIN') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid role');
    }

    // Check if username is unique
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    if (existingUser) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Username must be unique');
    }

    // Validate org unit exists and is active
    if (role !== 'SUPERADMIN') {
      const orgUnit = await prisma.orgUnit.findUnique({
        where: { id: orgUnitId }
      });
      if (!orgUnit) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Org unit not found');
      }
      if ((orgUnit as any).isActive === false) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Org unit is inactive');
      }

      // Validate role-org unit type compatibility
      if ((role === 'BUSINESS_PARTNER' && orgUnit.type !== 'BUSINESS_PARTNER') ||
          (role === 'FRANCHISE' && orgUnit.type !== 'FRANCHISE') ||
          ((role === 'CENTER_MANAGER' || role === 'ADMISSIONS' || role === 'TEACHER') && orgUnit.type !== 'CENTER')) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Role is not compatible with org unit type');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        role,
        orgUnitId: role === 'SUPERADMIN' ? null : orgUnitId
      }
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = newUser;
    
    // Log audit
    await logAudit(req, {
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      meta: { username: newUser.username, role: newUser.role, orgUnitId: newUser.orgUnitId }
    });

    ok(res, userWithoutPassword, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error creating user:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /api/superadmin/users/:id
// Role: SUPERADMIN only
// Update a user
router.put('/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // Validate input
    const validatedData = updateUserSchema.parse(req.body);

    const { role, orgUnitId, isActive, password } = validatedData;

    // Validate user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!existingUser) {
      return fail(res, 404, 'NOT_FOUND', 'User not found');
    }

    // Prepare update data
    const updateData: any = {};

    // Update role if provided
    if (role) {
      // Validate role
      const validRoles = ['BUSINESS_PARTNER', 'FRANCHISE', 'CENTER_MANAGER', 'ADMISSIONS', 'TEACHER'];
      if (!validRoles.includes(role) && role !== 'SUPERADMIN') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid role');
      }
      updateData.role = role;
    }

    // Update orgUnitId if provided
    if (orgUnitId !== undefined) {
      if (role === 'SUPERADMIN' || (existingUser.role && existingUser.role === 'SUPERADMIN')) {
        // SUPERADMIN users don't have org units
        updateData.orgUnitId = null;
      } else {
        // Validate org unit exists and is active
        const orgUnit = await prisma.orgUnit.findUnique({
          where: { id: orgUnitId }
        });
        if (!orgUnit) {
          return fail(res, 400, 'VALIDATION_ERROR', 'Org unit not found');
        }
        if ((orgUnit as any).isActive === false) {
          return fail(res, 400, 'VALIDATION_ERROR', 'Org unit is inactive');
        }

        // Validate role-org unit type compatibility
        const userRole = role || existingUser.role;
        if ((userRole === 'BUSINESS_PARTNER' && orgUnit.type !== 'BUSINESS_PARTNER') ||
            (userRole === 'FRANCHISE' && orgUnit.type !== 'FRANCHISE') ||
            ((userRole === 'CENTER_MANAGER' || userRole === 'ADMISSIONS' || userRole === 'TEACHER') && orgUnit.type !== 'CENTER')) {
          return fail(res, 400, 'VALIDATION_ERROR', 'Role is not compatible with org unit type');
        }
        updateData.orgUnitId = orgUnitId;
      }
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      (updateData as any).isActive = isActive;
    }

    // Update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      updateData.passwordHash = hashedPassword;
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = updatedUser;
    
    // Log audit
    await logAudit(req, {
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      meta: { 
        username: updatedUser.username, 
        changes: { role, orgUnitId, isActive, password: password ? '***' : undefined }
      }
    });

    ok(res, userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error updating user:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /api/superadmin/users/:id/reset-password
// Role: SUPERADMIN only
// Reset user password
router.post('/:id/reset-password', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // Validate input
    const validatedData = changePasswordSchema.parse(req.body);

    const { newPassword } = validatedData;

    // Validate user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!existingUser) {
      return fail(res, 404, 'NOT_FOUND', 'User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the user's password
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword
      }
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = updatedUser;
    
    // Log audit
    await logAudit(req, {
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: updatedUser.id,
      meta: { username: updatedUser.username }
    });

    ok(res, { message: 'Password reset successfully', user: userWithoutPassword });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Validation error', error.errors);
    }
    console.error('Error resetting password:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /api/superadmin/users/:id
// Role: SUPERADMIN only
// Soft delete a user (set isActive to false)
router.delete('/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Validate user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!existingUser) {
      return fail(res, 404, 'NOT_FOUND', 'User not found');
    }

    // Soft delete by setting isActive to false
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false
      } as any
    });

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = updatedUser;
    
    // Log audit
    await logAudit(req, {
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: updatedUser.id,
      meta: { username: updatedUser.username }
    });

    ok(res, { message: 'User deactivated successfully', user: userWithoutPassword });
  } catch (error) {
    console.error('Error deleting user:', error);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;