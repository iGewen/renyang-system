/**
 * TabBar.tsx - 底部导航栏组件
 * 从 App.tsx 拆分出来的独立模块
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from '../ui';
import { cn } from '../../lib/utils';
import { notificationApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ==================== TabBar 组件 ====================

const TabBarComponent: React.FC = () => {
  const location = useLocation();
  const { token } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const [unreadCount, setUnreadCount] = useState(0);

  // 获取未读消息数的函数
  const fetchUnreadCount = useCallback(() => {
    if (!token) return;

    notificationApi.getUnreadCount().then(res => {
      setUnreadCount(res.count || 0);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();

    // 每60秒刷新一次（优化：减少轮询频率）
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // 路由变化时刷新未读数
  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname, fetchUnreadCount]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-md md:max-w-lg mx-auto px-6 pb-6 pointer-events-auto">
        <div className="bg-brand-primary/95 backdrop-blur-md rounded-[32px] flex justify-around items-center py-3 px-4 safe-area-bottom shadow-2xl shadow-brand-primary/40 border border-white/10">
          <Link to="/" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px]", isActive('/') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="探索首页" aria-current={isActive('/') ? 'page' : undefined}>
            <Icons.Home className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">探索</span>
          </Link>
          <Link to="/my-adoptions" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px]", isActive('/my-adoptions') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="我的牧场" aria-current={isActive('/my-adoptions') ? 'page' : undefined}>
            <Icons.Package className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">牧场</span>
          </Link>
          <Link to="/profile" className={cn("flex flex-col items-center justify-center gap-1 transition-colors duration-200 min-w-[60px] relative", isActive('/profile') ? "text-white" : "text-white/40 hover:text-white/60")} aria-label="个人中心" aria-current={isActive('/profile') ? 'page' : undefined}>
            <Icons.User className="w-6 h-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wider uppercase">我的</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-2 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
};

// ==================== GlobalTabBar 组件 ====================

export const GlobalTabBar: React.FC = () => {
  const location = useLocation();
  // 只在首页、我的牧场、个人中心页面显示底部导航
  const showTabBarPages = ['/', '/my-adoptions', '/profile'];
  const shouldShow = showTabBarPages.includes(location.pathname);

  if (!shouldShow) return null;

  return <TabBarComponent />;
};

// 导出 TabBar 供其他地方使用
export const TabBar = TabBarComponent;
