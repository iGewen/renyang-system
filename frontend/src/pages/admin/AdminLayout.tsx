import React, { useState, useEffect } from 'react';
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
  adminInfo: any;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ activeMenu, onMenuChange, adminInfo, onLogout, collapsed, onToggleCollapse }) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 bg-slate-900 flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo 区域 */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
            <Icons.LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-white truncate">牧场管理后台</h1>
              <p className="text-xs text-slate-500 truncate">Cloud Ranch Admin</p>
            </div>
          )}
        </div>
      </div>

      {/* 折叠按钮 */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
      >
        <Icons.ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
      </button>

      {/* 菜单列表 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
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
                  ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-white border border-violet-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                collapsed && "justify-center px-0"
              )}
            >
              {/* 活跃指示器 */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-violet-500 to-cyan-500 rounded-r-full" />
              )}

              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-violet-400")} />

              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-violet-500 text-white rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}

              {/* 折叠时的 Tooltip */}
              {collapsed && isHovered && (
                <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-xl border border-slate-700">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* 管理员信息 */}
      <div className="p-3 border-t border-slate-800">
        {!collapsed ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {adminInfo?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{adminInfo?.name || '管理员'}</p>
              <p className="text-xs text-slate-500">{adminInfo?.role === 1 ? '超级管理员' : '管理员'}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
              title="退出登录"
            >
              <Icons.LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              {adminInfo?.name?.charAt(0) || 'A'}
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="退出登录"
            >
              <Icons.LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

// ==================== 顶部栏组件 ====================

interface HeaderBarProps {
  title: string;
  adminInfo: any;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ title, adminInfo }) => {
  const currentTime = new Date();
  const hour = currentTime.getHours();
  let greeting = '早上好';
  if (hour >= 12 && hour < 18) greeting = '下午好';
  else if (hour >= 18) greeting = '晚上好';

  return (
    <header className="h-16 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* 搜索框 */}
        <div className="relative hidden md:block">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索..."
            className="w-48 lg:w-64 pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200/50 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
          />
        </div>

        {/* 通知 */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <Icons.Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* 分隔线 */}
        <div className="h-8 w-px bg-slate-200" />

        {/* 用户信息 */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">{greeting}，{adminInfo?.name || '管理员'}</p>
            <p className="text-xs text-slate-400">{adminInfo?.role === 1 ? '超级管理员' : '管理员'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
            {adminInfo?.name?.charAt(0) || 'A'}
          </div>
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
    <div className="min-h-screen bg-slate-50/50">
      {/* 侧边栏 */}
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={onMenuChange}
        adminInfo={adminInfo}
        onLogout={onLogout}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* 主内容区 */}
      <main
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          collapsed ? "ml-20" : "ml-64"
        )}
      >
        {/* 顶部栏 */}
        <HeaderBar title={pageTitle} adminInfo={adminInfo} />

        {/* 内容区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
