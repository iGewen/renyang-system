/**
 * NotificationBadge.tsx - 消息角标组件
 * 从 App.tsx 拆分出来的独立模块
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { notificationApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationBadgeProps {
  variant?: 'default' | 'compact';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ variant = 'default' }) => {
  const [count, setCount] = useState(0);
  const { token, isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // 只有登录后才获取未读数
    if (!token || !isAuthenticated) {
      setCount(0);
      return;
    }
    notificationApi.getUnreadCount().then(res => {
      setCount(res.count || 0);
    }).catch(() => {
      setCount(0);
    });
  }, [token, isAuthenticated, location.pathname]);

  if (count === 0) return null;

  // 根据变体返回不同样式
  if (variant === 'compact') {
    return <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{count > 9 ? '9+' : count}</span>;
  }

  return <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">{count > 9 ? '9+' : count}</span>;
};
