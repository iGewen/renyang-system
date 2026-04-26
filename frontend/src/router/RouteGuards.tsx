import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 管理后台路由守卫
 */
export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const adminToken = sessionStorage.getItem('admin_token');

  if (!adminToken) {
    return <Navigate to="/admin-login" replace />;
  }

  try {
    const payload = JSON.parse(atob(adminToken.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_info');
      return <Navigate to="/admin-login" replace />;
    }
  } catch {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_info');
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

/**
 * 用户路由守卫
 */
export const UserProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();

  if (!token || !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
