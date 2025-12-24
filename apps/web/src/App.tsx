import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SuperadminLayout from './layouts/SuperadminLayout';
import SuperadminDashboard from './pages/SuperadminDashboardReal';
import AbacusCourseStudio from './pages/AbacusCourseStudio';
import SuperadminAbacusBuilder from './pages/SuperadminAbacusBuilder';
import AbacusStudents from './pages/AbacusStudents';
import AbacusStudentDetail from './pages/AbacusStudentDetail';
import AbacusEnrollments from './pages/AbacusEnrollments';
import AbacusEnrollmentDetail from './pages/AbacusEnrollmentDetail';
import BusinessPartnerLayout from './layouts/BusinessPartnerLayout';
import BusinessPartnerDashboard from './pages/BusinessPartnerDashboardReal';
import FranchiseLayout from './layouts/FranchiseLayout';
import FranchiseDashboard from './pages/FranchiseDashboardReal';
import CenterLayout from './layouts/CenterLayout';
import CenterDashboard from './pages/CenterDashboardReal';
import HeadCoordinatorLayout from './layouts/HeadCoordinatorLayout';
import CoordinatorLayout from './layouts/CoordinatorLayout';
import TeacherLayout from './layouts/TeacherLayout';
import TeacherDashboard from './pages/TeacherDashboardReal';
import FinanceSettings from './pages/FinanceSettings';
import FinanceDues from './pages/FinanceDues';
import FinanceTransactions from './pages/FinanceTransactions';
import FinanceSettlements from './pages/FinanceSettlements';
import FinanceSettlementDetail from './pages/FinanceSettlementDetail';
import BpFinanceSettlements from './pages/BpFinanceSettlements';
import BpFinanceSettlementDetail from './pages/BpFinanceSettlementDetail';
import FranchiseFinanceSettlements from './pages/FranchiseFinanceSettlements';
import FranchiseFinanceSettlementDetail from './pages/FranchiseFinanceSettlementDetail';
import CenterFinanceSettlements from './pages/CenterFinanceSettlements';
import CenterFinanceSettlementDetail from './pages/CenterFinanceSettlementDetail';
import HeadCoordinatorFinanceSettlements from './pages/HeadCoordinatorFinanceSettlements';
import HeadCoordinatorFinanceSettlementDetail from './pages/HeadCoordinatorFinanceSettlementDetail';
import CenterFinance from './pages/CenterFinance';
import TestPage from './pages/TestPage';
import SimpleFinanceSettings from './pages/SimpleFinanceSettings';
import SuperadminOrgUnits from './pages/SuperadminOrgUnits';
import SuperadminUsers from './pages/SuperadminUsers';
import SuperadminReports from './pages/SuperadminReports';
import CenterTeacherAssignments from './pages/CenterTeacherAssignments';
import CenterSchedule from './pages/CenterSchedule';
import CenterAttendance from './pages/CenterAttendance';
import TeacherMyStudents from './pages/TeacherMyStudents';
import TeacherMyEnrollments from './pages/TeacherMyEnrollments';
import TeacherCurriculum from './pages/TeacherCurriculum';
import TeacherSchedule from './pages/TeacherSchedule';
import TeacherAttendance from './pages/TeacherAttendance';
import TeacherEnrollmentDetail from './pages/TeacherEnrollmentDetail';
import StudentDashboardPage from './pages/StudentDashboardPage';
import StudentLayout from './layouts/StudentLayout';
import StudentCoursesPage from './pages/StudentCoursesPage';
import StudentWorksheetsPage from './pages/StudentWorksheetsPage';
import StudentWorksheetAttemptPage from './pages/StudentWorksheetAttemptPage';
import StudentWorksheetHistoryPage from './pages/StudentWorksheetHistoryPage';
import StudentWorksheetPlayer from './pages/StudentWorksheetPlayer';
import StudentExamPlayer from './pages/StudentExamPlayer';
import TeacherExamAttemptsPage from './pages/TeacherExamAttemptsPage';
import TeacherExamAttemptDetailPage from './pages/TeacherExamAttemptDetailPage';
import TeacherWorksheetAttemptReviewPage from './pages/TeacherWorksheetAttemptReviewPage';
import TeacherWorksheetHistoryPage from './pages/TeacherWorksheetHistoryPage';
import StudentExamsPage from './pages/StudentExamsPage';
import SuperadminLicensing from './pages/SuperadminLicensing';
import SuperadminActivity from './pages/SuperadminActivity';
import SuperadminLicenseOrders from './pages/SuperadminLicenseOrders';
import SuperadminAllocations from './pages/SuperadminAllocations';
import SuperadminCommercialHistory from './pages/SuperadminCommercialHistory';
import SuperadminSalesConsole from './pages/SuperadminSalesConsole';
import BpLeadsPage from './pages/BpLeadsPage';
import FranchiseLeadsPage from './pages/FranchiseLeadsPage';
import CenterLeadsPage from './pages/CenterLeadsPage';
import CoordinatorLeadsPage from './pages/CoordinatorLeadsPage';
import CoordinatorCentersPage from './pages/CoordinatorCentersPage';
import CoordinatorTeachersPage from './pages/CoordinatorTeachersPage';
import CoordinatorStudentsPage from './pages/CoordinatorStudentsPage';
import CoordinatorAttendanceSummaryPage from './pages/CoordinatorAttendanceSummaryPage';
import CoordinatorProgressSummaryPage from './pages/CoordinatorProgressSummaryPage';
import CoordinatorFlagAttendanceIssuePage from './pages/CoordinatorFlagAttendanceIssuePage';
import CoordinatorFlagProgressIssuePage from './pages/CoordinatorFlagProgressIssuePage';
import CoordinatorWorkflowsPage from './pages/CoordinatorWorkflowsPage';
import CertificateVerifyPage from './pages/CertificateVerifyPage';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import HeadCoordinatorDashboard from './pages/HeadCoordinatorDashboard';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/certificate/:number" element={<CertificateVerifyPage />} />
            
            {/* Superadmin routes */}
            <Route path="/superadmin" element={<SuperadminLayout />}>
            <Route index element={<SuperadminDashboard />} />
            <Route path="dashboard" element={<SuperadminDashboard />} />
            <Route path="abacus-course-studio" element={<AbacusCourseStudio />} />
            <Route path="abacus-builder" element={<SuperadminAbacusBuilder />} />
            <Route path="abacus-students" element={<AbacusStudents />} />
            <Route path="abacus-students/:id" element={<AbacusStudentDetail />} />
            <Route path="abacus-enrollments" element={<AbacusEnrollments />} />
            <Route path="abacus-enrollments/:id" element={<AbacusEnrollmentDetail />} />
            <Route path="finance-settings" element={<FinanceSettings />} />
            <Route path="finance-dues" element={<FinanceDues />} />
            <Route path="finance-dues" element={<FinanceDues />} />
            <Route path="finance-transactions" element={<FinanceTransactions />} />
            <Route path="finance-settlements" element={<FinanceSettlements />} />
            <Route path="finance-settlements/:id" element={<FinanceSettlementDetail />} />
            <Route path="licensing" element={<SuperadminLicensing />} />
            <Route path="license-orders" element={<SuperadminLicenseOrders />} />
            <Route path="licensing/allocations" element={<SuperadminAllocations />} />
            <Route path="commercial-history" element={<SuperadminCommercialHistory />} />
            <Route path="sales" element={<SuperadminSalesConsole />} />
            <Route path="activity" element={<SuperadminActivity />} />
            <Route path="org-management" element={<SuperadminOrgUnits />} />
            <Route path="users" element={<SuperadminUsers />} />
            <Route path="reports" element={<SuperadminReports />} />
            <Route path="test" element={<TestPage />} />
            <Route path="simple-finance-settings" element={<SimpleFinanceSettings />} />
            <Route path="student-dashboard/:studentId" element={<StudentDashboardPage />} />
          </Route>
          
          {/* Business Partner routes */}
          <Route path="/business-partner" element={<BusinessPartnerLayout />}>
            <Route index element={<BusinessPartnerDashboard />} />
            <Route path="dashboard" element={<BusinessPartnerDashboard />} />
            <Route path="leads" element={<BpLeadsPage />} />
            <Route path="finance/settlements" element={<BpFinanceSettlements />} />
            <Route path="finance/settlements/:id" element={<BpFinanceSettlementDetail />} />
          </Route>
          
          {/* Franchise routes */}
          <Route path="/franchise" element={<FranchiseLayout />}>
            <Route index element={<FranchiseDashboard />} />
            <Route path="dashboard" element={<FranchiseDashboard />} />
            <Route path="leads" element={<FranchiseLeadsPage />} />
            <Route path="finance/settlements" element={<FranchiseFinanceSettlements />} />
            <Route path="finance/settlements/:id" element={<FranchiseFinanceSettlementDetail />} />
          </Route>
          
          {/* Center routes */}
          <Route path="/center" element={<CenterLayout />}>
            <Route index element={<CenterDashboard />} />
            <Route path="dashboard" element={<CenterDashboard />} />
            <Route path="leads" element={<CenterLeadsPage />} />
            <Route path="students" element={<AbacusStudents />} />
            <Route path="enrollments" element={<AbacusEnrollments />} />
            <Route path="teacher-assignments" element={<CenterTeacherAssignments />} />
            <Route path="schedule" element={<CenterSchedule />} />
            <Route path="attendance" element={<CenterAttendance />} />
            <Route path="finance" element={<CenterFinance />} />
            <Route path="finance/settlements" element={<CenterFinanceSettlements />} />
            <Route path="finance/settlements/:id" element={<CenterFinanceSettlementDetail />} />
            <Route path="students/:studentId/dashboard" element={<StudentDashboardPage />} />
          </Route>

          {/* Head Coordinator routes */}
          <Route path="/head-coordinator" element={<HeadCoordinatorLayout />}>
            <Route index element={<HeadCoordinatorDashboard />} />
            <Route path="dashboard" element={<HeadCoordinatorDashboard />} />
            <Route path="students" element={<AbacusStudents />} />
            <Route path="enrollments" element={<AbacusEnrollments />} />
            <Route path="attendance" element={<CenterAttendance />} />
            <Route path="reports" element={<SuperadminReports />} />
            <Route path="finance/settlements" element={<HeadCoordinatorFinanceSettlements />} />
            <Route path="finance/settlements/:id" element={<HeadCoordinatorFinanceSettlementDetail />} />
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
          
          {/* Teacher routes */}
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="my-students" element={<TeacherMyStudents />} />
            <Route path="my-enrollments" element={<TeacherMyEnrollments />} />
            <Route path="enrollments/:enrollmentId" element={<TeacherEnrollmentDetail />} />
            <Route path="curriculum" element={<TeacherCurriculum />} />
            <Route path="schedule" element={<TeacherSchedule />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="worksheet-attempts" element={<TeacherWorksheetHistoryPage />} />
            <Route path="exams/attempts" element={<TeacherExamAttemptsPage />} />
            <Route path="exams/attempts/:attemptId" element={<TeacherExamAttemptDetailPage />} />
            <Route
              path="worksheets/review/attempts/:attemptId"
              element={<TeacherWorksheetAttemptReviewPage />}
            />
            <Route path="students/:studentId/dashboard" element={<StudentDashboardPage />} />
          </Route>

          {/* Student routes */}
          <Route path="/student" element={<StudentLayout />}>
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="courses" element={<StudentCoursesPage />} />
            <Route path="worksheets" element={<StudentWorksheetsPage />} />
            <Route path="worksheets" element={<StudentWorksheetsPage />} />
            <Route path="exams" element={<StudentExamsPage />} />
            <Route path="exams/:examId/play" element={<StudentExamPlayer />} />
            <Route path="exam-attempts/:attemptId/play" element={<StudentExamPlayer />} />
            <Route path="worksheets/:worksheetId/play" element={<StudentWorksheetPlayer />} />
            <Route path="worksheet-attempts/:attemptId/play" element={<StudentWorksheetPlayer />} />
            <Route path="worksheet-attempts/:attemptId" element={<StudentWorksheetAttemptPage />} />
            <Route path="worksheets/attempt/:attemptId" element={<StudentWorksheetAttemptPage />} />
            <Route path="attempts" element={<StudentWorksheetHistoryPage />} />
          </Route>
        </Routes>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
