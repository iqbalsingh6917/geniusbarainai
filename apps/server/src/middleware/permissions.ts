import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ROLE_PERMISSIONS, RolePermissions } from '../config/permissions';
import { Role } from '../constants/roles';

// Type for permission keys
type PermissionKey = keyof RolePermissions;

/**
 * Require a specific permission for a route
 * @param permissionKey The permission key to check
 * @returns Express middleware function
 */
export const requirePermission = (permissionKey: PermissionKey) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user role
    const userRole = req.user.role as Role;

    // Check if role exists in permissions
    if (!(userRole in ROLE_PERMISSIONS)) {
      return res.status(403).json({ error: `Unknown role: ${userRole}` });
    }

    // Check if user has the required permission
    const hasPermission = ROLE_PERMISSIONS[userRole][permissionKey];

    if (!hasPermission) {
      return res.status(403).json({ 
        error: `Forbidden: missing permission ${permissionKey}` 
      });
    }

    // User has permission, proceed to next middleware
    next();
  };
};

// Helper functions for specific permissions
export const requireStudentCRUD = requirePermission('canCRUDStudents');
export const requireEnrollmentCRUD = requirePermission('canCRUDEnrollments');
export const requireCurriculumManage = requirePermission('canManageCurriculum');
export const requireAssessmentCreate = requirePermission('canAddAssessments');
export const requireProgressUpdate = requirePermission('canUpdateProgress');
export const requireOrgManage = requirePermission('canManageOrg');
export const requirePaymentView = requirePermission('canViewPayments');
export const requirePaymentRecord = requirePermission('canRecordPayments');
