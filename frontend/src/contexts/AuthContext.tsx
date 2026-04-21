/**
 * AuthContext.tsx - 认证上下文
 * 从 App.tsx 拆分出来的独立模块
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { User } from '../types';

// ==================== 类型定义 ====================

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

// ==================== Context 创建 ====================

const AuthContext = createContext<AuthContextType | null>(null);

// 默认认证值 - 使用稳定对象避免每次渲染创建新对象
const DEFAULT_AUTH_VALUE: AuthContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
};

// ==================== Hook ====================

export const useAuth = () => {
  const context = useContext(AuthContext);
  // 返回稳定的默认值，而不是每次创建新对象
  return context ?? DEFAULT_AUTH_VALUE;
};

// ==================== Provider ====================

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 导出 Context 以供特殊情况使用
export default AuthContext;
