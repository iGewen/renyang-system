import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Icons } from '../../components/ui';

// ==================== 类型定义 ====================

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: MenuItem[];
}

interface AdminLayoutProps {
  children: React.ReactNode;
  activeMenu: string;
  onMenuChange: (menu: string) => void;
  adminInfo: any;
  onLogout: () => void;
}

// ==================== 侧边栏菜单配置 ====================

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: '控制台', icon: Icons.LayoutDashboard },
  { id: 'livestock', label: '活体管理', icon: Icons.Package },
  { id: 'orders', label: '订单管理', icon: Icons.ShoppingCart },
  { id: 'feed', label: '饲料费管理', icon: Icons.Coins },
  { id: 'redemption', label: '买断管理', icon: Icons.CheckCircle2 },
  { id: 'refunds', label: '退款管理', icon: Icons.RefreshCw },
  { id: 'users', label: '用户管理', icon: Icons.Users },
  { id: 'notifications', label: '站内信', icon: Icons.Bell },
  { id: 'agreements', label: '协议管理', icon: Icons.FileText },
  { id: 'logs', label: '审计日志', icon: Icons.ClipboardList },
  { id: 'config', label: '系统配置', icon: Icons.Settings },
];

// ==================== 侧边栏组件 ====================

const Sidebar: React.FC<{
  activeMenu: string;
  onMenuChange: (menu: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ activeMenu, onMenuChange, collapsed, onToggleCollapse }) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo 区域 */}
      <div className="h-16 flex items-center px-4 border-b border-slate-100">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-primary/20">
            <Icons.LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-brand-primary truncate">牧场管理后台</h1>
              <p className="text-xs text-slate-400 truncate">Cloud Ranch Admin</p>
            </div>
          )}
        </div>
      </div>

      {/* 折叠按钮 */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-brand-primary hover:border-brand-primary transition-colors z-10 shadow-sm"
      >
        <Icons.ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
      </button>

      {/* 菜单列表 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = activeMenu === item.id;
          const isHovered = hoveredItem === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
                isActive
                  ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0")} />

              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="px-2 py-0.5 text-xs bg-white/20 text-white rounded-full">
                      {item.badge! > 99 ? '99+' : String(item.badge)}
                    </span>
                  )}
                </>
              )}

              {/* 折叠时的 Tooltip */}
              {collapsed && isHovered && (
                <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-xl">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

// ==================== 顶部栏组件 ====================

interface HeaderBarProps {
  title: string;
  adminInfo: any;
  onLogout: () => void;
  onMenuChange: (menu: string) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ title, adminInfo, onLogout, onMenuChange }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* 通知 */}
        <button
          onClick={() => onMenuChange('notifications')}
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          title="站内信"
        >
          <Icons.Bell className="w-5 h-5" />
        </button>

        {/* 分隔线 */}
        <div className="h-8 w-px bg-slate-200" />

        {/* 用户信息 + 退出 */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{adminInfo?.username || '管理员'}</p>
            <p className="text-xs text-slate-400">{adminInfo?.role === 1 ? '超级管理员' : '管理员'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-md shadow-brand-primary/20">
            {adminInfo?.username?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          {/* 退出按钮 */}
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="退出登录"
          >
            <Icons.LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

// ==================== 主布局组件 ====================

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeMenu,
  onMenuChange,
  adminInfo,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // 获取当前页面标题
  const currentPage = menuItems.find(item => item.id === activeMenu);
  const pageTitle = currentPage?.label || '控制台';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 侧边栏 */}
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={onMenuChange}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* 主内容区 */}
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "ml-20" : "ml-64"
        )}
      >
        {/* 顶部栏 */}
        <HeaderBar title={pageTitle} adminInfo={adminInfo} onLogout={onLogout} onMenuChange={onMenuChange} />

        {/* 内容区域 */}
        <main className="p-6 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
