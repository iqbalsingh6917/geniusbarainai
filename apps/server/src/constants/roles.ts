// User roles in the system
export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  BUSINESS_PARTNER: 'BUSINESS_PARTNER',
  FRANCHISE: 'FRANCHISE',
  CENTER_MANAGER: 'CENTER_MANAGER',
  HEAD_COORDINATOR: 'HEAD_COORDINATOR',
  COORDINATOR: 'COORDINATOR',
  ADMISSIONS: 'ADMISSIONS',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;

// Type for role values
export type Role = typeof ROLES[keyof typeof ROLES];

// Role checking functions
export const isSuperadmin = (role: string): boolean => {
  return role === ROLES.SUPERADMIN;
};

export const isBusinessPartner = (role: string): boolean => {
  return role === ROLES.BUSINESS_PARTNER;
};

export const isFranchise = (role: string): boolean => {
  return role === ROLES.FRANCHISE;
};

export const isCenterManager = (role: string): boolean => {
  return role === ROLES.CENTER_MANAGER;
};

export const isHeadCoordinator = (role: string): boolean => {
  return role === ROLES.HEAD_COORDINATOR;
};

export const isCoordinator = (role: string): boolean => {
  return role === ROLES.COORDINATOR;
};

export const isAdmissions = (role: string): boolean => {
  return role === ROLES.ADMISSIONS;
};

export const isTeacher = (role: string): boolean => {
  return role === ROLES.TEACHER;
};

export const isStudent = (role: string): boolean => {
  return role === ROLES.STUDENT;
};

// Allowed features per role (commented for now, no enforcement)
/*
export const ROLE_FEATURES = {
  [ROLES.SUPERADMIN]: [
    'view_everything',
    'manage_org_tree',
    'monitor_metrics',
    'crud_students',
    'crud_enrollments',
    'view_curriculum',
    'update_progress'
  ],
  [ROLES.BUSINESS_PARTNER]: [
    'view_franchises_centers',
    'view_metrics'
  ],
  [ROLES.FRANCHISE]: [
    'view_centers',
    'view_limited_metrics'
  ],
  [ROLES.CENTER_MANAGER]: [
    'crud_students',
    'crud_enrollments',
    'view_curriculum',
    'update_progress'
  ],
  [ROLES.ADMISSIONS]: [
    'crud_students',
    'crud_enrollments'
  ],
  [ROLES.TEACHER]: [
    'view_assigned_students',
    'view_levels_worksheets'
  ]
};
*/
