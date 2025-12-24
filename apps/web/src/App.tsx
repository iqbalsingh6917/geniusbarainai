import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Layouts
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';
import CenterLayout from './layouts/CenterLayout';
import FranchiseLayout from './layouts/FranchiseLayout';
import BusinessPartnerLayout from './layouts/BusinessPartnerLayout';
import SuperadminLayout from './layouts/SuperadminLayout';
import CoordinatorLayout from './layouts/CoordinatorLayout';
import HeadCoordinatorLayout from './layouts/HeadCoordinatorLayout';

// Pages
import LoginPage from './pages/LoginPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import StudentWorksheetsPage from './pages/StudentWorksheetsPage';
import StudentExamsPage from './pages/StudentExamsPage';
import StudentWorksheetAttemptPage from './pages/StudentWorksheetAttemptPage';
import StudentWorksheetHistoryPage from './pages/StudentWorksheetHistoryPage';
import StudentExamAttemptPage from './pages/StudentExamPlayer';
import StudentWorksheetPlayer from './pages/StudentWorksheetPlayer';

import TeacherDashboard from './pages/TeacherDashboardReal';
import TeacherMyStudents from './pages/TeacherMyStudents';
import TeacherWorksheetHistoryPage from './pages/TeacherWorksheetHistoryPage';
import TeacherWorksheetAttemptReviewPage from './pages/TeacherWorksheetAttemptReviewPage';
import TeacherEnrollmentDetail from './pages/TeacherEnrollmentDetail';

// Phase 21A pages
import CoordinatorWorkflowsPage from './pages/CoordinatorWorkflowsPage';
import CoordinatorCentersPage from './pages/CoordinatorCentersPage';
import CoordinatorTeachersPage from './pages/CoordinatorTeachersPage';
import CoordinatorStudentsPage from './pages/CoordinatorStudentsPage';
import CoordinatorAttendanceSummaryPage from './pages/CoordinatorAttendanceSummaryPage';
import CoordinatorProgressSummaryPage from './pages/CoordinatorProgressSummaryPage';
import CoordinatorFlagAttendanceIssuePage from './pages/CoordinatorFlagAttendanceIssuePage';
import CoordinatorFlagProgressIssuePage from './pages/CoordinatorFlagProgressIssuePage';

// Phase 21B pages
import TeacherWorksheetsPage from './pages/TeacherWorksheetsPage';
import TeacherExamsPage from './pages/TeacherExamsPage';
import TeacherSubmissionsPage from './pages/TeacherSubmissionsPage';
import TeacherGradeSubmissionPage from './pages/TeacherGradeSubmissionPage';

// Other pages
import CenterDashboardReal from './pages/CenterDashboardReal';
import SuperadminUsers from './pages/SuperadminUsers';
import SuperadminReports from './pages/SuperadminReports';
import FranchiseDashboard from './pages/FranchiseDashboard';
import BusinessPartnerDashboard from './pages/BusinessPartnerDashboard';
import HeadCoordinatorDashboard from './pages/HeadCoordinatorDashboard';
import HeadCoordinatorFinanceSettlements from './pages/HeadCoordinatorFinanceSettlements';
import HeadCoordinatorFinanceSettlementDetail from './pages/HeadCoordinatorFinanceSettlementDetail';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import CoordinatorLeadsPage from './pages/CoordinatorLeadsPage';
import CenterAttendance from './pages/CenterAttendance';
import CenterTeacherAssignments from './pages/CenterTeacherAssignments';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Student routes */}
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<StudentDashboardPage />} />
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="worksheets" element={<StudentWorksheetsPage />} />
              <Route path="exams" element={<StudentExamsPage />} />
              <Route path="worksheets/:worksheetId/start" element={<StudentWorksheetPlayer />} />
              <Route path="worksheets/attempts/:attemptId" element={<StudentWorksheetAttemptPage />} />
              <Route path="worksheets/history" element={<StudentWorksheetHistoryPage />} />
              <Route path="exams/:examId/start" element={<StudentExamAttemptPage />} />
            </Route>

            {/* Teacher routes */}
            <Route path="/teacher" element={<TeacherLayout />}>
              <Route index element={<TeacherDashboard />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="worksheets" element={<TeacherWorksheetsPage />} />
              <Route path="exams" element={<TeacherExamsPage />} />
              <Route path="submissions" element={<TeacherSubmissionsPage />} />
              <Route path="submissions/:id/grade" element={<TeacherGradeSubmissionPage />} />
              <Route path="my-students" element={<TeacherMyStudents />} />
              <Route path="worksheet-attempts" element={<TeacherWorksheetHistoryPage />} />
              <Route path="worksheet-attempts/:attemptId/review" element={<TeacherWorksheetAttemptReviewPage />} />
              <Route path="enrollments/:enrollmentId" element={<TeacherEnrollmentDetail />} />
            </Route>

            {/* Center Manager routes */}
            <Route path="/center" element={<CenterLayout />}>
              <Route index element={<CenterDashboardReal />} />
              <Route path="dashboard" element={<CenterDashboardReal />} />
              <Route path="leads" element={<Navigate to="/center/leads/active" replace />} />
              {/* Removed coordinator leads access - coordinators should not access sales leads */}
              {/* <Route path="leads" element={<CoordinatorLeadsPage />} /> */}
              <Route path="leads/:filter" element={<CenterDashboardReal />} />
            </Route>

            {/* Franchise routes */}
            <Route path="/franchise" element={<FranchiseLayout />}>
              <Route index element={<FranchiseDashboard />} />
              <Route path="dashboard" element={<FranchiseDashboard />} />
            </Route>

            {/* Business Partner routes */}
            <Route path="/bp" element={<BusinessPartnerLayout />}>
              <Route index element={<BusinessPartnerDashboard />} />
              <Route path="dashboard" element={<BusinessPartnerDashboard />} />
            </Route>

            {/* Superadmin routes */}
            <Route path="/superadmin" element={<SuperadminLayout />}>
              <Route index element={<SuperadminUsers />} />
              <Route path="users" element={<SuperadminUsers />} />
              <Route path="reports" element={<SuperadminReports />} />
            </Route>

            {/* Coordinator routes */}
            <Route path="/coordinator" element={<CoordinatorLayout />}>
              <Route index element={<CoordinatorWorkflowsPage />} />
              <Route path="dashboard" element={<CoordinatorDashboard />} />
              <Route path="leads" element={<CoordinatorLeadsPage />} />
              <Route path="centers" element={<CoordinatorCentersPage />} />
              <Route path="teachers" element={<CoordinatorTeachersPage />} />
              <Route path="students" element={<CoordinatorStudentsPage />} />
              <Route path="attendance" element={<CenterAttendance />} />
              <Route path="attendance-summary" element={<CoordinatorAttendanceSummaryPage />} />
              <Route path="progress-summary" element={<CoordinatorProgressSummaryPage />} />
              <Route path="teacher-assignments" element={<CenterTeacherAssignments />} />
              <Route path="flag-attendance-issue" element={<CoordinatorFlagAttendanceIssuePage />} />
              <Route path="flag-progress-issue" element={<CoordinatorFlagProgressIssuePage />} />
              <Route path="reports" element={<SuperadminReports />} />
              <Route path="workflows" element={<CoordinatorWorkflowsPage />} />
            </Route>

            {/* Head Coordinator routes */}
            <Route path="/head-coordinator" element={<HeadCoordinatorLayout />}>
              <Route index element={<HeadCoordinatorDashboard />} />
              <Route path="dashboard" element={<HeadCoordinatorDashboard />} />
              <Route path="finance" element={<HeadCoordinatorFinanceSettlements />} />
              <Route path="finance/:id" element={<HeadCoordinatorFinanceSettlementDetail />} />
            </Route>

            {/* Default route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;