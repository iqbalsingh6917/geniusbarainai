import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    console.log('Login form submitted with username:', username);
    
    try {
      const loggedInUser = await login(username, password);
      console.log('Login function returned:', loggedInUser);
      if (loggedInUser) {
        console.log('Login successful, attempting navigation for user:', loggedInUser.username);
        switch (loggedInUser.role) {
          case 'SUPERADMIN':
            navigate('/superadmin/dashboard');
            break;
          case 'BUSINESS_PARTNER':
            navigate('/business-partner/dashboard');
            break;
          case 'FRANCHISE':
            navigate('/franchise/dashboard');
            break;
          case 'CENTER_MANAGER':
          case 'ADMISSIONS':
            navigate('/center/dashboard');
            break;
          case 'TEACHER':
            navigate('/teacher/dashboard');
            break;
          case 'STUDENT':
            navigate('/student/dashboard');
            break;
          default:
            navigate(from, { replace: true });
        }
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('An error occurred during login');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="split-screen-login">
      {/* Colorful Design Side */}
      <div className="login-design-side">
        <div className="design-element"></div>
        <div className="design-element"></div>
        <div className="design-element"></div>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', zIndex: 1 }}>
          Welcome
        </h1>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', zIndex: 1 }}>
          Beats Learning
        </h1>
        <p style={{ fontSize: '1.2rem', maxWidth: '80%', textAlign: 'center', zIndex: 1, opacity: 0.9 }}>
          Empowering education through innovative learning solutions
        </p>
      </div>
      
      {/* Login Form Side */}
      <div className="login-form-side">
        <div className="login-form-wrapper">
          <div className="form-header">
            <h1>Sign In</h1>
            <p>Enter your credentials to access your account</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="form-control"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ 
                color: '#ef4444', 
                backgroundColor: '#fee2e2', 
                padding: '0.75rem', 
                borderRadius: '6px', 
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-login">
              Sign In
            </button>
            
            <div className="forgot-password">
              <Link to="/forgot-password">
                Forgot your password?
              </Link>
            </div>
          </form>
          
            <div className="credentials-card">
              <h3>Test Credentials</h3>
              <div className="credentials-list">
                <p><strong>Superadmin:</strong> SA001 / Test@12345</p>
                <p><strong>Business Partner:</strong> BP001 / Test@12345</p>
                <p><strong>Franchise:</strong> FR001 / Test@12345</p>
                <p><strong>Center Manager:</strong> CE001 / Test@12345</p>
                <p><strong>Admissions:</strong> AD001 / Test@12345</p>
                <p><strong>Teacher:</strong> TEA001 / Test@12345</p>
                <p><strong>Student:</strong> STU001 / Test@12345</p>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
