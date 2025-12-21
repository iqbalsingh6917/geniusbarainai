// Shared types for Beats LMS v2

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AbacusCourse {
  id: number;
  code: string;
  name: string;
  variant: string;
  description?: string;
  modules: AbacusModule[];
}

export interface AbacusModule {
  id: number;
  courseId: number;
  index: number;
  title: string;
  summary?: string;
  skillFocus?: string; // Add skillFocus field
}

export interface AbacusLevel {
  id: number;
  moduleId: number; // Add moduleId field
  moduleCode?: string; // Make moduleCode optional
  order: number;
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  ageGroup?: string;
  operations: string[];
  formulas?: string[];
  visualization?: string;
  maxDigits?: number;
  maxTerms?: number;
  examDurationMin: number;
  passingPercent: number;
  timeBonusEnabled: boolean;
  scoringRules?: any;
  notes?: string;
}

// Add AbacusWorksheet interface
export interface AbacusWorksheet {
  id: number;
  levelId: number;
  title: string;
  kind: 'PRACTICE' | 'SPEED' | 'EXAM' | 'HOMEWORK' | 'AURALS';
  difficultyBand?: 'EASY' | 'MEDIUM' | 'HARD';
  questionCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Add Student interface
export interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName?: string;
  age?: number;
  parentName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  enrollmentsCount?: number;
}

// Add AbacusEnrollment interface
export interface AbacusEnrollment {
  id: number;
  studentId: number;
  courseId: number;
  currentModuleId?: number;
  currentLevelId?: number;
  status: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Related data (optional)
  student?: {
    id: number;
    code: string;
    firstName: string;
    lastName?: string;
  };
  course?: {
    id: number;
    code: string;
    name: string;
  };
  currentModule?: {
    id: number;
    title: string;
    index: number;
  };
  currentLevel?: {
    id: number;
    name: string;
    order: number;
  };
}

// Add AbacusAssessment interface
export interface AbacusAssessment {
  id: number;
  enrollmentId: number;
  levelId: number;
  scorePercent: number;
  passed: boolean;
  attemptDate: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  
  // Related data (optional)
  levelName?: string;
  levelOrder?: number;
}

// Add TeacherStudentAssignment interfaces
export interface Teacher {
  id: number;
  username: string;
  fullName: string;
}

export interface TeacherAssignment {
  id: number;
  teacherUserId: number;
  teacherName: string;
  studentId: number;
  studentName: string;
  enrollmentId: number | null;
}

export interface TeacherStudentAssignment {
  id: number;
  teacherUserId: number;
  studentId: number;
  enrollmentId: number | null;
  orgUnitId: number;
  createdAt: string;
  updatedAt: string;
}