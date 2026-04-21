/**
 * Navbar.tsx - 顶部导航栏组件
 * 从 App.tsx 拆分出来的独立模块
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icons } from '../ui';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBadge } from './NotificationBadge';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  transparent?: boolean;
  rightContent?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ title, showBack = false, transparent = false, rightContent }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className={cn("sticky top-0 z-50 transition-all", transparent ? "bg-transparent" : "bg-brand-bg/80 backdrop-blur-xl border-b border-slate-100")}>
      <div className="max-w-screen-xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform" aria-label="返回上一页">
              <Icons.ArrowLeft className="w-5 h-5 text-brand-primary" aria-hidden="true" />
            </button>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary tracking-tight">{title}</h1>
        </div>
        {rightContent || (
          <div className="flex gap-3">
            <Link to="/notifications" className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-brand-primary transition-colors relative" aria-label="通知消息">
              <Icons.Bell className="w-5 h-5" aria-hidden="true" />
              <NotificationBadge />
            </Link>
            <Link to={isAuthenticated ? "/profile" : "/auth"} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/20 flex items-center justify-center text-white hover:scale-105 transition-transform" aria-label={isAuthenticated ? "个人中心" : "登录"}>
              <Icons.User className="w-5 h-5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
