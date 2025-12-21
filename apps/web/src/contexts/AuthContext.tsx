import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../lib/roles';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing token on app load
  useEffect(() => {
    console.log('Checking for existing token on app load');
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    console.log('Stored token:', storedToken);
    console.log('Stored user:', storedUser);
    
    if (storedToken && storedUser && storedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('Parsed user:', parsedUser);
        setToken(storedToken);
        setUser(parsedUser);
        console.log('User state initialized from localStorage');
      } catch (error) {
        // If parsing fails, clear the invalid data
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else if (storedUser === 'undefined') {
      // Handle case where localStorage contains the literal string "undefined"
      console.warn('Invalid user data in localStorage, clearing...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else {
      console.log('No valid stored credentials found');
    }
  }, []);

  const login = async (username: string, password: string): Promise<User | null> => {
    try {
      console.log('Attempting login with username:', username);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      console.log('Login response status:', response.status);
      
      if (response.ok) {
        const payload = await response.json();
        console.log('Login successful, received data:', payload);
        
        // API returns { success: true, data: { token, user } }
        const apiData = (payload as any)?.data ?? payload;
        const receivedToken = apiData?.token;
        const receivedUser = apiData?.user;

        if (!receivedToken || !receivedUser) {
          console.error('Login response missing token or user:', apiData);
          return null;
        }

        setToken(receivedToken);
        setUser(receivedUser);
        
        // Store in localStorage
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));
        
        console.log('User state set:', receivedUser);
        
        return receivedUser as User;
      } else {
        const errorText = await response.text();
        console.log('Login failed with status:', response.status, 'and message:', errorText);
        return null;
      }
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
