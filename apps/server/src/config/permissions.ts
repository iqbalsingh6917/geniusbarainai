import { Role } from '../constants/roles';

export interface RolePermissions {
  // Org management
  canManageOrg: boolean;
  canViewHierarchy: boolean;
  
  // Curriculum management
  canManageCurriculum: boolean;
  
  // Student operations
  canCRUDStudents: boolean;
  
  // Enrollment operations
  canCRUDEnrollments: boolean;
  
  // Progress and assessments
  canUpdateProgress: boolean;
  canAddAssessments: boolean;
  
  // Payments
  canViewPayments: boolean;
  canRecordPayments: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  SUPERADMIN: {
    canManageOrg: true,
    canViewHierarchy: true,
    canManageCurriculum: true,
    canCRUDStudents: false,
    canCRUDEnrollments: true,
    canUpdateProgress: false,
    canAddAssessments: false,
    canViewPayments: true,
    canRecordPayments: false,
  },
  BUSINESS_PARTNER: {
    canManageOrg: false,
    canViewHierarchy: true,
    canManageCurriculum: false,
    canCRUDStudents: false,
    canCRUDEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    canViewPayments: true,
    canRecordPayments: false,
  },
  FRANCHISE: {
    canManageOrg: false,
    canViewHierarchy: true,
    canManageCurriculum: false,
    canCRUDStudents: false,
    canCRUDEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    canViewPayments: false,
    canRecordPayments: false,
  },
  CENTER_MANAGER: {
    canManageOrg: false,
    canViewHierarchy: true,
    canManageCurriculum: false,
    canCRUDStudents: true,
    canCRUDEnrollments: true,
    canUpdateProgress: true,
    canAddAssessments: true,
    canViewPayments: true,
    canRecordPayments: false,
  },
  ADMISSIONS: {
    canManageOrg: false,
    canViewHierarchy: true,
    canManageCurriculum: false,
    canCRUDStudents: true,
    canCRUDEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    canViewPayments: false,
    canRecordPayments: false,
  },
  TEACHER: {
    canManageOrg: false,
    canViewHierarchy: false,
    canManageCurriculum: false,
    canCRUDStudents: false,
    canCRUDEnrollments: false,
    canUpdateProgress: true,
    canAddAssessments: true,
    canViewPayments: false,
    canRecordPayments: false,
  },
  STUDENT: {
    canManageOrg: false,
    canViewHierarchy: false,
    canManageCurriculum: false,
    canCRUDStudents: false,
    canCRUDEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    canViewPayments: false,
    canRecordPayments: false,
  },
};
