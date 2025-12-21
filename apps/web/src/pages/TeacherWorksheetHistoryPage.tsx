import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

interface AttemptSummary {
  id: number;
  status: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  teacherAdjustedScore: number | null;
  teacherComment: string | null;
  reviewedAt: string | null;
  reviewStatus?: 'PENDING' | 'REVIEWED';
  worksheet: { id: number; title: string };
  course: { code: string; name: string };
  module: { id: number; name: string; index: number };
  level: { id: number; name: string; order: number };
}

interface AssignmentSummary {
  id: number;
  status: string;
  dueDate: string | null;
  submittedAt: string | null;
  worksheet: { id: number; title: string };
  course: { code: string; name: string };
  module: { id: number; name: string; index: number };
  level: { id: number; name: string; order: number };
  student: { id: number; name: string };
}

interface ReviewQuestion {
  id: number;
  orderIndex: number;
  prompt: string;
  correctAnswer: string;
  answerGiven: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  maxMarks: number;
}

interface ReviewAttempt {
  attempt: {
    id: number;
    status: string;
    totalScore: number | null;
    maxScore: number | null;
    teacherAdjustedScore: number | null;
    teacherComment: string | null;
    reviewedAt: string | null;
  };
  worksheet: { id: number; title: string };
  student: { id: number; code: string; name: string };
  assignment: any;
  questions: ReviewQuestion[];
}

const TeacherWorksheetHistoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [search] = useSearchParams();
  const [studentIdInput, setStudentIdInput] = useState<string>(search.get('studentId') || '');
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<ReviewAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assigned' | 'submitted' | 'pending'>('assigned');
  const [filters, setFilters] = useState({
    courseCode: '',
    moduleId: '',
    levelId: '',
    fromDate: '',
    toDate: '',
  });
  const [feedback, setFeedback] = useState<{ comment: string; adjustedScore: string }>({
    comment: '',
    adjustedScore: '',
  });

  const fetchHistory = async (studentId: number) => {
    try {
      setLoading(true);
      const data: AttemptSummary[] = await apiClient.get(
        `/api/teacher/worksheets/attempts/history/${studentId}`
      );
      setAttempts(data || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load attempts', 'error');
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (studentIdInput) params.set('studentId', studentIdInput);
      if (filters.courseCode) params.set('courseCode', filters.courseCode);
      if (filters.moduleId) params.set('moduleId', filters.moduleId);
      if (filters.levelId) params.set('levelId', filters.levelId);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      params.set('status', 'NOT_STARTED,IN_PROGRESS');
      const data: AssignmentSummary[] = await apiClient.get(
        `/api/worksheet-assignments/teacher?${params.toString()}`
      );
      setAssignments(data || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load assignments', 'error');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async (mode: 'submitted' | 'pending') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (studentIdInput) params.set('studentId', studentIdInput);
      if (filters.courseCode) params.set('courseCode', filters.courseCode);
      if (filters.moduleId) params.set('moduleId', filters.moduleId);
      if (filters.levelId) params.set('levelId', filters.levelId);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      params.set('status', mode === 'submitted' ? 'SUBMITTED,GRADED' : 'SUBMITTED');
      if (mode === 'pending') params.set('reviewStatus', 'PENDING');
      const data: AttemptSummary[] = await apiClient.get(
        `/api/teacher/worksheets/attempts?${params.toString()}`
      );
      setAttempts(data || []);
    } catch (err: any) {
      showToast(err?.message || 'Unable to load attempts', 'error');
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempt = async (attemptId: number) => {
    try {
      setReviewLoading(true);
      const data: ReviewAttempt = await apiClient.get(
        `/api/teacher/worksheets/review/attempts/${attemptId}`
      );
      setSelectedAttempt(data);
      setFeedback({
        comment: data.attempt.teacherComment || '',
        adjustedScore:
          data.attempt.teacherAdjustedScore !== null && data.attempt.teacherAdjustedScore !== undefined
            ? String(data.attempt.teacherAdjustedScore)
            : '',
      });
    } catch (err: any) {
      showToast(err?.message || 'Unable to load attempt', 'error');
      setSelectedAttempt(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedAttempt) return;
    try {
      const payload: any = {};
      if (feedback.comment) payload.teacherComment = feedback.comment;
      if (feedback.adjustedScore !== '') payload.teacherAdjustedScore = Number(feedback.adjustedScore);
      await apiClient.put(
        `/api/teacher/worksheets/review/attempts/${selectedAttempt.attempt.id}/feedback`,
        payload
      );
      showToast('Feedback saved', 'success');
      await fetchAttempt(selectedAttempt.attempt.id);
      if (studentIdInput) {
        fetchHistory(Number(studentIdInput));
      }
      if (activeTab === 'assigned') {
        fetchAssignments();
      } else if (activeTab === 'submitted') {
        fetchAttempts('submitted');
      } else {
        fetchAttempts('pending');
      }
    } catch (err: any) {
      showToast(err?.message || 'Unable to save feedback', 'error');
    }
  };

  useEffect(() => {
    if (studentIdInput) {
      const idNum = parseInt(studentIdInput, 10);
      if (!Number.isNaN(idNum)) {
        fetchHistory(idNum);
      }
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, []);

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.2rem' }}>Worksheet Attempts</h1>
          <div className="muted">View and review attempts for your students.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="muted">Student ID</div>
            <input
              type="text"
              className="form-control"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              placeholder="Enter student ID"
            />
          </div>
          <div className="stat-card">
            <div className="muted">Course code</div>
            <input
              type="text"
              className="form-control"
              value={filters.courseCode}
              onChange={(e) => setFilters((prev) => ({ ...prev, courseCode: e.target.value }))}
              placeholder="ABACUS_L1_REGULAR"
            />
          </div>
          <div className="stat-card">
            <div className="muted">Module ID</div>
            <input
              type="number"
              className="form-control"
              value={filters.moduleId}
              onChange={(e) => setFilters((prev) => ({ ...prev, moduleId: e.target.value }))}
              placeholder="Module id"
            />
          </div>
          <div className="stat-card">
            <div className="muted">Level ID</div>
            <input
              type="number"
              className="form-control"
              value={filters.levelId}
              onChange={(e) => setFilters((prev) => ({ ...prev, levelId: e.target.value }))}
              placeholder="Level id"
            />
          </div>
          <div className="stat-card">
            <div className="muted">From date</div>
            <input
              type="date"
              className="form-control"
              value={filters.fromDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
            />
          </div>
          <div className="stat-card">
            <div className="muted">To date</div>
            <input
              type="date"
              className="form-control"
              value={filters.toDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
            />
          </div>
          <div className="stat-card" style={{ alignItems: 'flex-end' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (activeTab === 'assigned') {
                  fetchAssignments();
                } else if (activeTab === 'submitted') {
                  fetchAttempts('submitted');
                } else {
                  fetchAttempts('pending');
                }
                setSelectedAttemptId(null);
                setSelectedAttempt(null);
              }}
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div className="card-title">Worksheets</div>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'assigned' ? 'tab-active' : ''}`}
              onClick={() => {
                setActiveTab('assigned');
                setAttempts([]);
                setSelectedAttemptId(null);
                setSelectedAttempt(null);
                fetchAssignments();
              }}
            >
              Assigned
            </button>
            <button
              className={`tab ${activeTab === 'submitted' ? 'tab-active' : ''}`}
              onClick={() => {
                setActiveTab('submitted');
                setAssignments([]);
                setSelectedAttemptId(null);
                setSelectedAttempt(null);
                fetchAttempts('submitted');
              }}
            >
              Submitted
            </button>
            <button
              className={`tab ${activeTab === 'pending' ? 'tab-active' : ''}`}
              onClick={() => {
                setActiveTab('pending');
                setAssignments([]);
                setSelectedAttemptId(null);
                setSelectedAttempt(null);
                fetchAttempts('pending');
              }}
            >
              Pending review
            </button>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
            <LoadingSpinner size="md" />
          </div>
        ) : activeTab === 'assigned' ? (
          assignments.length === 0 ? (
            <div className="muted">No assignments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Worksheet</th>
                    <th>Course/Module/Level</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.student.name || '-'}</td>
                      <td>{assignment.worksheet.title}</td>
                      <td>
                        <div>{assignment.course.code}</div>
                        <div className="muted">
                          Module {assignment.module.index} - Level {assignment.level.order}
                        </div>
                      </td>
                      <td>{assignment.status}</td>
                      <td>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : attempts.length === 0 ? (
          <div className="muted">No attempts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Worksheet</th>
                  <th>Course/Module/Level</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Review</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.worksheet.title}</td>
                    <td>
                      <div>{attempt.course.code}</div>
                      <div className="muted">
                        Module {attempt.module.index} - Level {attempt.level.order}
                      </div>
                    </td>
                    <td>{attempt.status}</td>
                    <td>
                      {attempt.teacherAdjustedScore !== null
                        ? `${attempt.teacherAdjustedScore} (adjusted)`
                        : attempt.totalScore !== null && attempt.maxScore !== null
                          ? `${attempt.totalScore} / ${attempt.maxScore}`
                          : '-'}
                    </td>
                    <td>
                      {attempt.reviewedAt ? (
                        <span className="badge badge-success">Reviewed</span>
                      ) : (
                        <span className="badge badge-neutral">Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedAttemptId(attempt.id);
                          fetchAttempt(attempt.id);
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedAttemptId && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Review attempt #{selectedAttemptId}</div>
              <div className="muted">{selectedAttempt?.student.name}</div>
            </div>
          </div>
          {reviewLoading || !selectedAttempt ? (
            <div style={{ textAlign: 'center', padding: '0.5rem' }}>
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: '0.75rem' }}>
                <div className="stat-card">
                  <div className="muted">Auto score</div>
                  <div>
                    {selectedAttempt.attempt.totalScore ?? 0} / {selectedAttempt.attempt.maxScore ?? 0}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="muted">Adjusted score</div>
                  <div>{selectedAttempt.attempt.teacherAdjustedScore ?? '-'}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Reviewed</div>
                  <div>{selectedAttempt.attempt.reviewedAt ? new Date(selectedAttempt.attempt.reviewedAt).toLocaleString() : 'Not yet'}</div>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--color-bg-soft)', marginBottom: '0.75rem' }}>
                <div className="card-header">
                  <div className="card-title">Feedback</div>
                </div>
                <div className="form-group">
                  <label>Teacher comment</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={feedback.comment}
                    onChange={(e) => setFeedback((prev) => ({ ...prev, comment: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Adjusted score (optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={feedback.adjustedScore}
                    onChange={(e) => setFeedback((prev) => ({ ...prev, adjustedScore: e.target.value }))}
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleFeedbackSubmit}>
                  Save feedback
                </button>
              </div>

              <div className="card-header">
                <div className="card-title">Answers</div>
              </div>
              <div className="question-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedAttempt.questions.map((q) => (
                  <div key={q.id} className="card" style={{ background: 'var(--color-bg-soft)' }}>
                    <div className="card-header">
                      <div className="card-title">
                        Q{q.orderIndex}: {q.prompt}
                      </div>
                      <span className={q.isCorrect ? 'badge badge-success' : 'badge badge-danger'}>
                        {q.isCorrect ? 'Correct' : 'Wrong'}
                      </span>
                    </div>
                    <div className="muted">Student: {q.answerGiven || '-'}</div>
                    <div className="muted">Correct: {q.correctAnswer}</div>
                    <div className="muted">
                      Marks: {q.marksAwarded ?? 0} / {q.maxMarks}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherWorksheetHistoryPage;
