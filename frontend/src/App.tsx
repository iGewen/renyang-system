/**
 * App.tsx - 主应用入口
 *
 * 重构完成：路由配置已拆分至 router/ 目录
 * - 路由配置: router/index.tsx
 * - 路由守卫: router/RouteGuards.tsx
 */

import { useEffect } from 'react';
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { GlobalTabBar } from './components/layout';
import { AppRoutes } from './router';

// 认证过期处理组件
const AuthExpiredHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleUserExpired = () => {
      // 不在登录页时才跳转
      if (location.pathname !== '/auth') {
        navigate('/auth', { replace: true });
      }
    };

    globalThis.addEventListener('auth:user-expired', handleUserExpired);
    return () => {
      globalThis.removeEventListener('auth:user-expired', handleUserExpired);
    };
  }, [navigate, location.pathname]);

  return null;
};

export default function App() {
  return (
    <Router>
      <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden">
        <AuthExpiredHandler />
        <AnimatePresence mode="wait">
          <AppRoutes />
        </AnimatePresence>
        <GlobalTabBar />
      </div>
    </Router>
  );
}
