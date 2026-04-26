import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons, Card, EmptyState } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((id) => (
            <div key={`skeleton-stat-card-${id}`} className="bg-white rounded-2xl p-5 border border-slate-100">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-7 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-2 w-20 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const todayOrders = stats?.todayOrders || 0;
  const totalOrders = stats?.totalOrders || 0;
  const totalUsers = stats?.totalUsers || 0;
  const todayUsers = stats?.todayUsers || 0;
  const todayRevenue = stats?.todayRevenue || 0;
  const activeAdoptions = stats?.activeAdoptions || 0;

  const statCards = [
    {
      title: '今日收入',
      value: `¥${(todayRevenue || 0).toLocaleString()}`,
      subtitle: `活跃领养：${activeAdoptions}`,
      icon: Icons.DollarSign,
      iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      iconColor: 'text-white',
      gradient: 'from-emerald-500/10 to-teal-500/5',
      barGradient: 'from-emerald-400 to-teal-500',
    },
    {
      title: '今日订单',
      value: todayOrders.toLocaleString(),
      subtitle: `总计：${totalOrders} 笔`,
      icon: Icons.ShoppingCart,
      iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-500',
      iconColor: 'text-white',
      gradient: 'from-blue-500/10 to-indigo-500/5',
      barGradient: 'from-blue-400 to-indigo-500',
    },
    {
      title: '用户总数',
      value: totalUsers.toLocaleString(),
      subtitle: `今日新增：+${todayUsers}`,
      icon: Icons.Users,
      iconBg: 'bg-gradient-to-br from-purple-400 to-pink-500',
      iconColor: 'text-white',
      gradient: 'from-purple-500/10 to-pink-500/5',
      barGradient: 'from-purple-400 to-pink-500',
    },
    {
      title: '活跃领养',
      value: (stats?.activeAdoptions || 0).toLocaleString(),
      subtitle: `总领养：${stats?.totalAdoptions || 0} 笔`,
      icon: Icons.Package,
      iconBg: 'bg-gradient-to-br from-orange-400 to-amber-500',
      iconColor: 'text-white',
      gradient: 'from-orange-500/10 to-amber-500/5',
      barGradient: 'from-orange-400 to-amber-500',
    },
  ];

  const pendingItems = [
    { count: stats?.pendingOrders || 0, label: '待支付订单', icon: Icons.Clock, color: 'orange', menu: 'orders' },
    { count: stats?.pendingRedemptions || 0, label: '待审核买断', icon: Icons.FileCheck, color: 'blue', menu: 'redemption' },
    { count: stats?.exceptionAdoptions || 0, label: '逾期/异常', icon: Icons.AlertTriangle, color: 'red', menu: 'feed' },
    { count: stats?.pendingRefunds || 0, label: '待退款', icon: Icons.RefreshCw, color: 'amber', menu: 'orders' },
  ];

  const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
    orange: { bg: 'bg-orange-50 hover:bg-orange-100', iconBg: 'bg-orange-100', text: 'text-orange-600' },
    blue: { bg: 'bg-blue-50 hover:bg-blue-100', iconBg: 'bg-blue-100', text: 'text-blue-600' },
    red: { bg: 'bg-red-50 hover:bg-red-100', iconBg: 'bg-red-100', text: 'text-red-600' },
    amber: { bg: 'bg-amber-50 hover:bg-amber-100', iconBg: 'bg-amber-100', text: 'text-amber-600' },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">数据概览</h2>
          <p className="text-sm text-slate-400 mt-0.5">更新于 {new Date().toLocaleString('zh-CN')}</p>
        </div>
        <button
          onClick={() => { setLoading(true); adminApi.getDashboardStats().then(setStats).finally(() => setLoading(false)); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
        >
          <Icons.RefreshCw className="w-4 h-4" />刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={`stat-card-${card.title}`} className={cn("p-5 relative overflow-hidden group", `bg-gradient-to-br ${card.gradient}`)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                <p className="text-xs text-slate-400 mt-1.5">{card.subtitle}</p>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110", card.iconBg)}>
                <card.icon className={cn("w-6 h-6", card.iconColor)} />
              </div>
            </div>
            <div className={cn("absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r", card.barGradient)} />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">待处理事项</h3>
          <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full">
            <span className="text-2xl font-bold text-red-500">{pendingItems.reduce((sum, item) => sum + item.count, 0)}</span>
            <span className="text-sm text-red-400">项待处理</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pendingItems.map((item) => {
            const colors = colorMap[item.color];
            return (
              <motion.button
                key={`pending-${item.label}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/admin/${item.menu === 'dashboard' ? '' : item.menu}`)}
                className={cn("p-4 rounded-xl text-left transition-all cursor-pointer border border-transparent hover:border-slate-200", colors.bg)}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.iconBg)}>
                    <item.icon className={cn("w-5 h-5", colors.text)} />
                  </div>
                  <div>
                    <p className={cn("text-xl font-bold", colors.text)}>{item.count}</p>
                    <p className="text-xs text-slate-500">{item.label}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">领养类型分布</h3>
          {stats?.adoptionByType && stats.adoptionByType.length > 0 ? (
            <div className="space-y-4">
              {stats.adoptionByType.map((item: any, index: number) => {
                const total = stats.adoptionByType.reduce((sum: number, i: any) => sum + i.count, 0);
                const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
                const colors = ['from-brand-primary to-indigo-500', 'from-blue-400 to-blue-600', 'from-purple-400 to-purple-600', 'from-orange-400 to-orange-600', 'from-pink-400 to-pink-600'];
                return (
                  <div key={item.typeId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">{item.typeName}</span>
                      <span className="font-bold text-slate-900">{item.count} <span className="text-slate-400 font-normal text-xs">({percentage}%)</span></span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                        className={cn("h-full rounded-full bg-gradient-to-r", colors[index % colors.length])}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState variant="compact" icon={<Icons.PieChart className="w-8 h-8" />} title="暂无领养数据" description="领养记录将在此显示" />
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">收入概览</h3>
          <div className="space-y-3">
            {[
              { label: '今日收入', value: stats?.revenueToday || 0, icon: Icons.Calendar, gradient: 'from-emerald-50 to-teal-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', valueColor: 'text-emerald-600' },
              { label: '本月收入', value: stats?.revenueMonth || 0, icon: Icons.BarChart3, gradient: 'from-blue-50 to-indigo-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', valueColor: 'text-blue-600' },
              { label: '本年收入', value: stats?.revenueYear || 0, icon: Icons.TrendingUp, gradient: 'from-purple-50 to-pink-50', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', valueColor: 'text-purple-600' },
            ].map((item, idx) => (
              <motion.div
                key={`revenue-${item.label}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn("flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r border border-transparent hover:border-slate-100 transition-colors", item.gradient)}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", item.iconBg)}>
                  <item.icon className={cn("w-5 h-5", item.iconColor)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className={cn("text-lg font-bold", item.valueColor)}>¥{item.value.toLocaleString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">快捷操作</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: Icons.Plus, label: '添加活体', menu: 'livestock', bg: 'bg-brand-primary/10', color: 'text-brand-primary', hover: 'hover:bg-brand-primary/20' },
            { icon: Icons.Users, label: '用户管理', menu: 'users', bg: 'bg-blue-100', color: 'text-blue-600', hover: 'hover:bg-blue-200' },
            { icon: Icons.ShoppingCart, label: '订单管理', menu: 'orders', bg: 'bg-orange-100', color: 'text-orange-600', hover: 'hover:bg-orange-200' },
            { icon: Icons.Coins, label: '饲料费', menu: 'feed', bg: 'bg-amber-100', color: 'text-amber-600', hover: 'hover:bg-amber-200' },
            { icon: Icons.CheckCircle2, label: '买断审核', menu: 'redemption', bg: 'bg-purple-100', color: 'text-purple-600', hover: 'hover:bg-purple-200' },
            { icon: Icons.Settings, label: '系统配置', menu: 'config', bg: 'bg-slate-100', color: 'text-slate-600', hover: 'hover:bg-slate-200' },
          ].map((item) => (
            <motion.button
              key={`quick-action-${item.menu}`}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/admin/${item.menu === 'dashboard' ? '' : item.menu}`)}
              className={cn("flex flex-col items-center gap-2 p-4 rounded-xl transition-all cursor-pointer", item.bg, item.hover)}
            >
              <item.icon className={cn("w-6 h-6", item.color)} />
              <span className={cn("text-sm font-medium", item.color)}>{item.label}</span>
            </motion.button>
          ))}
        </div>
      </Card>
    </div>
  );
};
