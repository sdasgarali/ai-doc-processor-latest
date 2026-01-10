import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [clientInactive, setClientInactive] = useState(false);
  const [clientInactiveMessage, setClientInactiveMessage] = useState('');
  const isLoggingIn = useRef(false);

  // Set up axios interceptor to handle client inactive responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 && error.response?.data?.clientInactive) {
          setClientInactive(true);
          setClientInactiveMessage(error.response.data.message || 'Your client account is inactive.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  useEffect(() => {
    // Set axios defaults
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Only verify token on initial load, not after login (login already sets user)
      if (!isLoggingIn.current) {
        verifyToken();
      } else {
        isLoggingIn.current = false;
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get('/api/auth/verify');
      setUser(response.data.user);
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { token: newToken, user: userData } = response.data;

    // Set flag to prevent useEffect from calling verifyToken
    isLoggingIn.current = true;

    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setUser(userData);
    setToken(newToken);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setClientInactive(false);
    setClientInactiveMessage('');
    delete axios.defaults.headers.common['Authorization'];
  };

  const clearClientInactive = () => {
    setClientInactive(false);
    setClientInactiveMessage('');
  };

  const updateProfile = async (profileData) => {
    const response = await axios.put('/api/auth/profile', profileData);
    setUser({ ...user, ...profileData });
    return response.data;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: user?.user_role === 'admin' || user?.user_role === 'superadmin',
    isSuperAdmin: user?.user_role === 'superadmin',
    clientInactive,
    clientInactiveMessage,
    clearClientInactive
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
