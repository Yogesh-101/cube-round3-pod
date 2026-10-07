import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, loginUser, registerUser, logoutUser } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('recoveryos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('recoveryos_token'));
  const [loading, setLoading] = useState(true);

  // Validate session token on mount
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem('recoveryos_token');
      if (storedToken) {
        try {
          const profile = await getMe();
          setUser(profile);
          localStorage.setItem('recoveryos_user', JSON.stringify(profile));
        } catch (err) {
          console.warn('Session expired or invalid, logging out', err);
          localStorage.removeItem('recoveryos_token');
          localStorage.removeItem('recoveryos_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('recoveryos_token', data.token);
    localStorage.setItem('recoveryos_user', JSON.stringify(data.user));
    return data.user;
  };

  const register = async (formData) => {
    const data = await registerUser(formData);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('recoveryos_token', data.token);
    localStorage.setItem('recoveryos_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
