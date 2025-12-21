// Role utility functions for the frontend

export interface User {
  id: number;
  username: string;
  role: string;
  orgUnitId: number | null;
  studentId?: number | null;
}

// Role checking functions
export const isSuperadmin = (user: User | null): boolean => {
  return user?.role === 'SUPERADMIN';
};

export const isBusinessPartner = (user: User | null): boolean => {
  return user?.role === 'BUSINESS_PARTNER';
};

export const isFranchise = (user: User | null): boolean => {
  return user?.role === 'FRANCHISE';
};

export const isCenterManager = (user: User | null): boolean => {
  return user?.role === 'CENTER_MANAGER';
};

export const isAdmissions = (user: User | null): boolean => {
  return user?.role === 'ADMISSIONS';
};

export const isTeacher = (user: User | null): boolean => {
  return user?.role === 'TEACHER';
};

export const isStudent = (user: User | null): boolean => {
  return user?.role === 'STUDENT';
};

// Frontend permissions map
export const FRONTEND_PERMISSIONS = {
  SUPERADMIN: {
    showAbacusCourseStudio: true,
    showAbacusCurriculumBuilder: true,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: false,
    showOrgManagement: true,
    canCreateEditStudents: false,
    canCreateEditEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    'abacus.enrollment.view_center': false,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
  BUSINESS_PARTNER: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: false,
    showOrgManagement: true,
    canCreateEditStudents: false,
    canCreateEditEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    'abacus.enrollment.view_center': false,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
  FRANCHISE: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: false,
    showOrgManagement: true,
    canCreateEditStudents: false,
    canCreateEditEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    'abacus.enrollment.view_center': false,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
  CENTER_MANAGER: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: false,
    showOrgManagement: false,
    canCreateEditStudents: true,
    canCreateEditEnrollments: true,
    canUpdateProgress: true,
    canAddAssessments: true,
    'abacus.enrollment.view_center': true,
    'abacus.enrollment.create_center': true,
    'abacus.enrollment.update_center': true,
  },
  ADMISSIONS: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: false,
    showOrgManagement: false,
    canCreateEditStudents: true,
    canCreateEditEnrollments: true,
    canUpdateProgress: false,
    canAddAssessments: false,
    'abacus.enrollment.view_center': true,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
  TEACHER: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: true,
    showAbacusEnrollmentsPage: true,
    showTeacherDashboard: true,
    showOrgManagement: false,
    canCreateEditStudents: false,
    canCreateEditEnrollments: false,
    canUpdateProgress: true,
    canAddAssessments: true,
    'abacus.enrollment.view_center': false,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
  STUDENT: {
    showAbacusCourseStudio: false,
    showAbacusCurriculumBuilder: false,
    showAbacusStudentsPage: false,
    showAbacusEnrollmentsPage: false,
    showTeacherDashboard: false,
    showOrgManagement: false,
    canCreateEditStudents: false,
    canCreateEditEnrollments: false,
    canUpdateProgress: false,
    canAddAssessments: false,
    'abacus.enrollment.view_center': false,
    'abacus.enrollment.create_center': false,
    'abacus.enrollment.update_center': false,
  },
};
