/**
 * App.tsx - 主应用入口
 *
 * 重构完成：路由配置已拆分至 router/ 目录
 * - 路由配置: router/index.tsx
 * - 路由守卫: router/RouteGuards.tsx
 */

import { BrowserRouter as Router } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { GlobalTabBar } from './components/layout';
import { AppRoutes } from './router';

export default function App() {
  return (
    <Router>
      <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden">
        <AnimatePresence mode="wait">
          <AppRoutes />
        </AnimatePresence>
        <GlobalTabBar />
      </div>
    </Router>
  );
}
