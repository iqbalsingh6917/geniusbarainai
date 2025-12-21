import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';

interface AbacusModule {
  id: number;
  courseId: number;
  index: number;
  title: string;
  summary: string | null;
  skillFocus?: string; // Add skillFocus field
  levelCount?: number; // Add levelCount field
}

interface AbacusCourse {
  id: number;
  code: string;
  name: string;
  variant: string;
  description: string | null;
  modules: AbacusModule[];
}

const AbacusCourseStudio: React.FC = () => {
  const [courses, setCourses] = useState<AbacusCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/superadmin/abacus/courses');
      setCourses(data);
      setError(null);
    } catch (err) {
      setError('An error occurred while fetching courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLevels = (moduleId: number) => {
    // Navigate to the curriculum builder with the module ID as a query parameter
    navigate(`/superadmin/abacus-builder?moduleId=${moduleId}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="course-studio">
      <h1>Abacus Course Studio</h1>
      
      {courses.map(course => (
        <div key={course.id} className="course-card">
          <h2>{course.name}</h2>
          <div className="course-meta">
            <p><strong>Code:</strong> {course.code}</p>
            {course.variant && <p><strong>Variant:</strong> {course.variant}</p>}
            {course.variant === 'BEATS20' && <p className="badge">AI-enhanced</p>}
          </div>
          <div className="course-details">
            <p><strong>Description:</strong> {course.description || 'No description'}</p>
          </div>
          
          <h3>Modules ({course.modules.length})</h3>
          <div className="modules-list">
            {course.modules.map(module => (
              <div key={module.id} className="module-item">
                <div className="module-header">
                  <span className="module-index">Module {module.index}:</span>
                  <span className="module-title">{module.title}</span>
                  <button 
                    className="view-levels-btn"
                    onClick={() => handleViewLevels(module.id)}
                  >
                    View levels & worksheets
                  </button>
                </div>
                <div className="module-details">
                  {module.skillFocus && <p><strong>Skill Focus:</strong> {module.skillFocus}</p>}
                  {module.summary && <p className="module-summary">{module.summary}</p>}
                  <p><strong>Levels:</strong> {module.levelCount || 0} levels</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AbacusCourseStudio;
