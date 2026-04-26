import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../components/ui';
import { AdminLayout } from './AdminLayout';
import { adminApi } from '../../services/api';

// 导入拆分后的组件
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLivestock } from './components/AdminLivestock';
import { AdminOrders } from './components/AdminOrders';
import { AdminFeedBills } from './components/AdminFeedBills';
import { AdminRedemptions } from './components/AdminRedemptions';
import { AdminUsers } from './components/AdminUsers';
import { AdminConfig } from './components/AdminConfig';
import { AdminNotifications } from './components/AdminNotifications';
import { AdminAgreements } from './components/AdminAgreements';
import { AdminRefunds } from './components/AdminRefunds';
import { AdminAuditLogs } from './components/AdminAuditLogs';

// 重新导出组件（保持向后兼容）
export {
  AdminDashboard,
  AdminLivestock,
  AdminOrders,
  AdminFeedBills,
  AdminRedemptions,
  AdminUsers,
  AdminConfig,
  AdminNotifications,
  AdminAgreements,
  AdminRefunds,
  AdminAuditLogs,
};

// 菜单ID到组件的映射
const menuComponentMap: Record<string, React.FC> = {
  dashboard: AdminDashboard,
  livestock: AdminLivestock,
  orders: AdminOrders,
  feed: AdminFeedBills,
  redemption: AdminRedemptions,
  users: AdminUsers,
  config: AdminConfig,
  notifications: AdminNotifications,
  agreements: AdminAgreements,
  refunds: AdminRefunds,
  logs: AdminAuditLogs,
};

// 管理后台主页面
const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [adminInfo, setAdminInfo] = useState<any>(null);

  // 从URL路径解析当前菜单
  useEffect(() => {
    const path = location.pathname;
    // 路径格式: /admin 或 /admin/xxx
    const menuId = path.replace('/admin/', '').replace('/admin', '') || 'dashboard';
    if (menuComponentMap[menuId]) {
      setActiveMenu(menuId);
    }
  }, [location.pathname]);

  // 获取管理员信息
  useEffect(() => {
    adminApi.getCurrentAdmin()
      .then(setAdminInfo)
      .catch(() => {
        // 获取失败，跳转登录页
        navigate('/admin/login');
      });
  }, [navigate]);

  // 菜单切换时更新URL
  const handleMenuChange = (menu: string) => {
    setActiveMenu(menu);
    navigate(`/admin${menu === 'dashboard' ? '' : '/' + menu}`);
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  // 渲染当前菜单对应的组件
  const CurrentComponent = menuComponentMap[activeMenu] || AdminDashboard;

  return (
    <ToastProvider>
      <AdminLayout
        activeMenu={activeMenu}
        onMenuChange={handleMenuChange}
        adminInfo={adminInfo}
        onLogout={handleLogout}
      >
        <CurrentComponent />
      </AdminLayout>
    </ToastProvider>
  );
};

export default AdminPage;
