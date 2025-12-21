import React, { useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorCard from '../components/ui/ErrorCard';

type ModuleAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface ModuleAttemptInfo {
  status: ModuleAttemptStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

interface CourseItem {
  enrollmentId: number;
  courseCode: string;
  courseName: string;
  variant?: string;
  status: string;
  startedAt: string;
  currentModule: { id: number; name: string; index: number } | null;
  currentLevel: { id: number; name: string; order: number } | null;
  levelsCompleted: number;
  totalLevels: number;
}

interface CoursesResponse {
  studentId: number;
  courses: CourseItem[];
}

interface ModuleItem {
  moduleId: number;
  moduleName: string;
  moduleIndex: number;
  levelCount: number;
}

interface WorksheetsCourse {
  courseCode: string;
  courseName: string;
  modules: Array<{
    moduleId: number;
    moduleName: string;
    moduleIndex: number;
    levels: any[];
  }>;
}

const StudentCoursesPage: React.FC = () => {
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [modulesByCourse, setModulesByCourse] = useState<Record<string, ModuleItem[]>>({});
  const [attemptsByModule, setAttemptsByModule] = useState<Record<string, ModuleAttemptInfo>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const [coursesResp, worksheetsResp] = await Promise.all([
          apiClient.get('/api/student/me/courses'),
          apiClient.get('/api/student/me/worksheets').catch(() => null),
        ]);
        setData(coursesResp);
        if (worksheetsResp && worksheetsResp.courses) {
          const mapped: Record<string, ModuleItem[]> = {};
          (worksheetsResp.courses as WorksheetsCourse[]).forEach((course) => {
            mapped[course.courseCode] =
              course.modules?.map((m) => ({
                moduleId: m.moduleId,
                moduleName: m.moduleName,
                moduleIndex: m.moduleIndex,
                levelCount: Array.isArray(m.levels) ? m.levels.length : 0,
              })) || [];
          });
          setModulesByCourse(mapped);
        }
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const fetchAttemptsForEnrollment = async (enrollmentId: number) => {
    try {
      const resp = await apiClient.get(`/api/learning/module-attempts/by-enrollment/${enrollmentId}`);
      const items = resp?.items || [];
      setAttemptsByModule((prev) => {
        const next = { ...prev };
        items.forEach((a: any) => {
          const key = `${enrollmentId}:${a.moduleIndex}`;
          next[key] = {
            status: a.status as ModuleAttemptStatus,
            startedAt: a.startedAt,
            completedAt: a.completedAt,
            score: a.score,
            maxScore: a.maxScore,
          };
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to load module attempts', err);
    }
  };

  useEffect(() => {
    if (data?.courses) {
      data.courses.forEach((course) => {
        fetchAttemptsForEnrollment(course.enrollmentId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.courses?.length]);

  const badgeClass = (status: string) => {
    if (status === 'COMPLETED') return 'badge badge-success';
    if (status === 'PAUSED') return 'badge badge-warning';
    return 'badge badge-neutral';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center' }}>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorCard message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">My courses</h1>
          </div>
          <div className="muted">No courses assigned yet.</div>
        </div>
      </div>
    );
  }

  const handleStart = async (enrollmentId: number, courseCode: string, moduleIndex: number) => {
    const key = `${enrollmentId}:${moduleIndex}`;
    try {
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      await apiClient.post('/api/learning/module-attempts/start', {
        enrollmentId,
        courseCode,
        moduleIndex,
      });
      setAttemptsByModule((prev) => ({
        ...prev,
        [key]: {
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        },
      }));
    } catch (err) {
      console.error('Failed to start module attempt', err);
      alert('Could not start this module. Please refresh and try again.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleComplete = async (enrollmentId: number, courseCode: string, moduleIndex: number) => {
    const key = `${enrollmentId}:${moduleIndex}`;
    try {
      setActionLoading((prev) => ({ ...prev, [key]: true }));
      await apiClient.post('/api/learning/module-attempts/complete', {
        enrollmentId,
        courseCode,
        moduleIndex,
      });
      await fetchAttemptsForEnrollment(enrollmentId);
    } catch (err) {
      console.error('Failed to complete module attempt', err);
      alert('Could not mark this module as completed. Please refresh and try again.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.3rem' }}>My courses</h1>
          <div className="muted">Courses you are enrolled in</div>
        </div>
      </div>
      {data.courses.map((course) => {
        const percent =
          course.totalLevels > 0
            ? Math.round((course.levelsCompleted / course.totalLevels) * 100)
            : 0;
        const variantLabel = course.variant === 'BEATS20' ? ' · AI-enhanced' : '';
        return (
          <div className="card" key={course.enrollmentId}>
            <div className="card-header">
              <div>
                <div className="card-title">
                  {course.courseName}
                  {variantLabel && <span className="muted" style={{ marginLeft: '0.35rem' }}>{variantLabel.trim()}</span>}
                </div>
                <div className="muted">Code: {course.courseCode}</div>
              </div>
              <span className={badgeClass(course.status)}>{course.status}</span>
            </div>
            <div className="muted" style={{ marginBottom: '0.25rem' }}>
              Started: {course.startedAt ? new Date(course.startedAt).toLocaleDateString() : '-'}
            </div>
            <div className="muted" style={{ marginBottom: '0.25rem' }}>
              Levels completed: {course.levelsCompleted} of {course.totalLevels}
            </div>
            <div className="muted" style={{ marginBottom: '0.5rem' }}>
              {percent}% completion
            </div>
            <div className="progress" style={{ marginBottom: '0.75rem' }}>
              <div className="progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <div className="muted">
              Current module: {course.currentModule ? `${course.currentModule.name} (Module ${course.currentModule.index})` : 'Not set'}
            </div>
            <div className="muted">
              Current level: {course.currentLevel ? `${course.currentLevel.name} (Level ${course.currentLevel.order})` : 'Not set'}
            </div>
            {modulesByCourse[course.courseCode] && modulesByCourse[course.courseCode].length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold mb-2">Modules</div>
                <div className="space-y-2">
                  {modulesByCourse[course.courseCode].map((module) => {
                    const key = `${course.enrollmentId}:${module.moduleIndex}`;
                    const attempt = attemptsByModule[key];
                    const status: ModuleAttemptStatus = attempt?.status ?? 'NOT_STARTED';
                    const loadingAction = actionLoading[key] ?? false;
                    return (
                      <div key={module.moduleIndex} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div>
                          <div className="font-medium">
                            {module.moduleName} (Module {module.moduleIndex})
                          </div>
                          <div className="text-xs text-gray-500">
                            Levels: {module.levelCount}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge ${
                              status === 'COMPLETED'
                                ? 'badge-success'
                                : status === 'IN_PROGRESS'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </span>
                          {status === 'NOT_STARTED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleStart(course.enrollmentId, course.courseCode, module.moduleIndex)}
                              disabled={loadingAction}
                            >
                              {loadingAction ? 'Starting...' : 'Start module'}
                            </button>
                          )}
                          {status === 'IN_PROGRESS' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleComplete(course.enrollmentId, course.courseCode, module.moduleIndex)}
                              disabled={loadingAction}
                            >
                              {loadingAction ? 'Saving...' : 'Mark complete'}
                            </button>
                          )}
                          {status === 'COMPLETED' && (
                            <button className="btn btn-ghost btn-sm" disabled>
                              Completed
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StudentCoursesPage;

