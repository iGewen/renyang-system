import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, StatCard, Modal, Input, ConfirmDialog, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adminApi } from '../../services/api';
import type { Livestock, LivestockType, AdoptionOrder, FeedBill, User, DashboardStats, SystemConfig } from '../../types';

// ==================== 后台管理布局 ====================

interface AdminLayoutProps {
  children: React.ReactNode;
  activeMenu: string;
  onMenuChange: (menu: string) => void;
  adminInfo: any;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeMenu, onMenuChange, adminInfo, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: '控制台', icon: Icons.LayoutDashboard },
    { id: 'livestock', label: '活体管理', icon: Icons.Package },
    { id: 'orders', label: '订单管理', icon: Icons.ShoppingCart },
    { id: 'feed', label: '饲料费管理', icon: Icons.Coins },
    { id: 'redemption', label: '买断管理', icon: Icons.CheckCircle2 },
    { id: 'users', label: '用户管理', icon: Icons.Users },
    { id: 'config', label: '系统配置', icon: Icons.Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-brand-primary rounded-xl flex items-center justify-center mr-3">
            <Icons.LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-display font-bold text-brand-primary">牧场管理后台</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                activeMenu === item.id
                  ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-sm">
              {adminInfo?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{adminInfo?.name || '管理员'}</p>
              <p className="text-xs text-slate-400">{adminInfo?.role === 1 ? '超级管理员' : '管理员'}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Icons.LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden ml-64">
        {children}
      </main>
    </div>
  );
};

// ==================== 控制台 ====================

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">控制台</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="今日收入" value={`¥${stats?.revenueToday?.toLocaleString() || 0}`} icon={<Icons.DollarSign className="w-6 h-6" />} />
        <StatCard title="今日订单" value={stats?.orderToday || 0} icon={<Icons.ShoppingCart className="w-6 h-6" />} />
        <StatCard title="总用户数" value={stats?.userTotal?.toLocaleString() || 0} icon={<Icons.Users className="w-6 h-6" />} />
        <StatCard title="待处理事项" value={(stats?.pendingOrders || 0) + (stats?.pendingRedemptions || 0) + (stats?.exceptionAdoptions || 0)} icon={<Icons.AlertTriangle className="w-6 h-6" />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">领养类型分布</h3>
          <div className="space-y-3">
            {stats?.adoptionByType?.map((item: any) => (
              <div key={item.typeId} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.typeName}</span>
                <span className="text-sm font-bold text-brand-primary">{item.count}</span>
              </div>
            ))}
            {(!stats?.adoptionByType || stats.adoptionByType.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">暂无数据</p>
            )}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">待处理事项</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
              <span className="text-sm text-slate-600">待支付订单</span>
              <span className="text-sm font-bold text-orange-600">{stats?.pendingOrders || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm text-slate-600">待审核买断</span>
              <span className="text-sm font-bold text-blue-600">{stats?.pendingRedemptions || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <span className="text-sm text-slate-600">异常领养</span>
              <span className="text-sm font-bold text-red-600">{stats?.exceptionAdoptions || 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ==================== 活体管理 ====================

export const AdminLivestock: React.FC = () => {
  const [types, setTypes] = useState<LivestockType[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showLivestockModal, setShowLivestockModal] = useState(false);
  const [editingType, setEditingType] = useState<LivestockType | null>(null);
  const [editingLivestock, setEditingLivestock] = useState<Livestock | null>(null);

  const [typeForm, setTypeForm] = useState({ name: '', description: '' });
  const [livestockForm, setLivestockForm] = useState({
    name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: ''
  });

  useEffect(() => {
    Promise.all([adminApi.getLivestockTypes(), adminApi.getLivestockList()])
      .then(([typesRes, livestockRes]) => {
        setTypes(typesRes);
        setLivestock(livestockRes.list || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveType = async () => {
    try {
      if (editingType) {
        await adminApi.updateLivestockType(editingType.id, typeForm);
      } else {
        await adminApi.createLivestockType(typeForm);
      }
      const typesRes = await adminApi.getLivestockTypes();
      setTypes(typesRes);
      setShowTypeModal(false);
      setEditingType(null);
      setTypeForm({ name: '', description: '' });
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('确定要删除此类型吗？')) return;
    try {
      await adminApi.deleteLivestockType(id);
      setTypes(types.filter(t => t.id !== id));
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSaveLivestock = async () => {
    try {
      const data = {
        ...livestockForm,
        price: parseFloat(livestockForm.price),
        monthlyFeedFee: parseFloat(livestockForm.monthlyFeedFee),
        redemptionMonths: parseInt(livestockForm.redemptionMonths),
        stock: parseInt(livestockForm.stock)
      };
      if (editingLivestock) {
        await adminApi.updateLivestock(editingLivestock.id, data);
      } else {
        await adminApi.createLivestock(data);
      }
      const livestockRes = await adminApi.getLivestockList();
      setLivestock(livestockRes.list || []);
      setShowLivestockModal(false);
      setEditingLivestock(null);
      setLivestockForm({ name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: '' });
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await adminApi.updateLivestockStatus(id, currentStatus === 'on_sale' ? 'off_sale' : 'on_sale');
      setLivestock(livestock.map(l => l.id === id ? { ...l, status: currentStatus === 'on_sale' ? 'off_sale' : 'on_sale' } : l));
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">活体管理</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setEditingType(null); setTypeForm({ name: '', description: '' }); setShowTypeModal(true); }}>
            添加类型
          </Button>
          <Button onClick={() => { setEditingLivestock(null); setLivestockForm({ name: '', typeId: '', price: '', monthlyFeedFee: '', redemptionMonths: '12', stock: '', description: '', image: '' }); setShowLivestockModal(true); }}>
            添加活体
          </Button>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">活体类型</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {types.map(type => (
            <div key={type.id} className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
              <div>
                <p className="font-medium">{type.name}</p>
                <p className="text-xs text-slate-400">{type.description || '暂无描述'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingType(type); setTypeForm({ name: type.name, description: type.description || '' }); setShowTypeModal(true); }} className="text-brand-primary text-sm">编辑</button>
                <button onClick={() => handleDeleteType(type.id)} className="text-red-500 text-sm">删除</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">活体列表</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">库存</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {livestock.map(item => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-3 px-4">{item.name}</td>
                  <td className="py-3 px-4">{types.find(t => t.id === item.typeId)?.name || '-'}</td>
                  <td className="py-3 px-4">¥{item.price}</td>
                  <td className="py-3 px-4">{item.stock}</td>
                  <td className="py-3 px-4">
                    <Badge variant={item.status === 'on_sale' ? 'success' : 'default'}>{item.status === 'on_sale' ? '在售' : '下架'}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleStatus(item.id, item.status)} className="text-brand-primary text-sm">
                        {item.status === 'on_sale' ? '下架' : '上架'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {livestock.length === 0 && <EmptyState icon={<Icons.Package className="w-12 h-12" />} title="暂无活体数据" />}
        </div>
      </Card>

      <Modal open={showTypeModal} onClose={() => setShowTypeModal(false)} title={editingType ? '编辑类型' : '添加类型'}>
        <div className="space-y-4 p-6">
          <Input label="类型名称" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="请输入类型名称" />
          <Input label="描述" value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="请输入描述（选填）" />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowTypeModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSaveType}>保存</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLivestockModal} onClose={() => setShowLivestockModal(false)} title={editingLivestock ? '编辑活体' : '添加活体'}>
        <div className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
          <Input label="名称" value={livestockForm.name} onChange={e => setLivestockForm({ ...livestockForm, name: e.target.value })} placeholder="请输入活体名称" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">类型</label>
            <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none" value={livestockForm.typeId} onChange={e => setLivestockForm({ ...livestockForm, typeId: e.target.value })}>
              <option value="">请选择类型</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Input label="价格" type="number" value={livestockForm.price} onChange={e => setLivestockForm({ ...livestockForm, price: e.target.value })} placeholder="请输入价格" />
          <Input label="月饲料费" type="number" value={livestockForm.monthlyFeedFee} onChange={e => setLivestockForm({ ...livestockForm, monthlyFeedFee: e.target.value })} placeholder="请输入月饲料费" />
          <Input label="库存" type="number" value={livestockForm.stock} onChange={e => setLivestockForm({ ...livestockForm, stock: e.target.value })} placeholder="请输入库存数量" />
          <Input label="图片URL" value={livestockForm.image} onChange={e => setLivestockForm({ ...livestockForm, image: e.target.value })} placeholder="请输入图片URL" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
            <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none" rows={3} value={livestockForm.description} onChange={e => setLivestockForm({ ...livestockForm, description: e.target.value })} placeholder="请输入描述" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowLivestockModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSaveLivestock}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ==================== 订单管理 ====================

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<AdoptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    adminApi.getOrders({ status: statusFilter || undefined })
      .then(res => setOrders(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    pending: { label: '待支付', variant: 'warning' },
    paid: { label: '已支付', variant: 'success' },
    cancelled: { label: '已取消', variant: 'default' },
    expired: { label: '已过期', variant: 'danger' }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">订单管理</h2>
        <div className="flex gap-2">
          {['', 'pending', 'paid', 'cancelled'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === status ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === '' ? '全部' : statusMap[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">订单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">活体</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{order.orderNo}</td>
                  <td className="py-3 px-4">{order.user?.phone || '-'}</td>
                  <td className="py-3 px-4">{order.livestock?.name || '-'}</td>
                  <td className="py-3 px-4">¥{order.totalAmount}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusMap[order.status]?.variant || 'default'}>{statusMap[order.status]?.label || order.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState icon={<Icons.ShoppingCart className="w-12 h-12" />} title="暂无订单数据" />}
        </div>
      </Card>
    </div>
  );
};

// ==================== 饲料费管理 ====================

export const AdminFeedBills: React.FC = () => {
  const [bills, setBills] = useState<FeedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    adminApi.getFeedBills({ status: statusFilter || undefined })
      .then(res => setBills(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    unpaid: { label: '待支付', variant: 'warning' },
    paid: { label: '已支付', variant: 'success' },
    overdue: { label: '已逾期', variant: 'danger' },
    waived: { label: '已免除', variant: 'default' }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">饲料费管理</h2>
        <div className="flex gap-2">
          {['', 'unpaid', 'paid', 'overdue'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === status ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === '' ? '全部' : statusMap[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">账单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">滞纳金</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">到期日</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{bill.billNo}</td>
                  <td className="py-3 px-4">{bill.adoption?.user?.phone || '-'}</td>
                  <td className="py-3 px-4">¥{bill.amount}</td>
                  <td className="py-3 px-4">¥{bill.lateFeeAmount || 0}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusMap[bill.status]?.variant || 'default'}>{statusMap[bill.status]?.label || bill.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && <EmptyState icon={<Icons.Coins className="w-12 h-12" />} title="暂无饲料费账单" />}
        </div>
      </Card>
    </div>
  );
};

// ==================== 买断管理 ====================

export const AdminRedemptions: React.FC = () => {
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    adminApi.getRedemptions({ status: statusFilter || undefined })
      .then(res => setRedemptions(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    pending: { label: '待审核', variant: 'warning' },
    approved: { label: '已通过', variant: 'success' },
    rejected: { label: '已拒绝', variant: 'danger' },
    paid: { label: '已支付', variant: 'info' },
    completed: { label: '已完成', variant: 'success' }
  };

  const handleAudit = async (id: string, approved: boolean) => {
    try {
      await adminApi.auditRedemption(id, { approved });
      const res = await adminApi.getRedemptions({ status: statusFilter || undefined });
      setRedemptions(res.list || []);
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">买断管理</h2>
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === status ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === '' ? '全部' : statusMap[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">买断单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">活体</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map(item => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{item.redemptionNo}</td>
                  <td className="py-3 px-4">{item.adoption?.user?.phone || '-'}</td>
                  <td className="py-3 px-4">{item.adoption?.livestock?.name || '-'}</td>
                  <td className="py-3 px-4">¥{item.amount}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusMap[item.status]?.variant || 'default'}>{statusMap[item.status]?.label || item.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {item.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAudit(item.id, true)} className="text-green-600 text-sm font-medium">通过</button>
                        <button onClick={() => handleAudit(item.id, false)} className="text-red-500 text-sm font-medium">拒绝</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {redemptions.length === 0 && <EmptyState icon={<Icons.CheckCircle2 className="w-12 h-12" />} title="暂无买断申请" />}
        </div>
      </Card>
    </div>
  );
};

// ==================== 用户管理 ====================

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    adminApi.getUsers({ keyword: keyword || undefined })
      .then(res => setUsers(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [keyword]);

  const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    normal: { label: '正常', variant: 'success' },
    restricted: { label: '受限', variant: 'warning' },
    banned: { label: '封禁', variant: 'danger' }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">用户管理</h2>
        <Input placeholder="搜索用户" value={keyword} onChange={e => setKeyword(e.target.value)} icon={<Icons.Search className="w-5 h-5" />} className="w-64" />
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">手机号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">昵称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">余额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{user.id?.substring(0, 8)}</td>
                  <td className="py-3 px-4">{user.phone}</td>
                  <td className="py-3 px-4">{user.nickname || '-'}</td>
                  <td className="py-3 px-4">¥{user.balance?.toFixed(2) || '0.00'}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusMap[user.status]?.variant || 'default'}>{statusMap[user.status]?.label || user.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState icon={<Icons.Users className="w-12 h-12" />} title="暂无用户数据" />}
        </div>
      </Card>
    </div>
  );
};

// ==================== 系统配置 ====================

export const AdminConfig: React.FC = () => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'payment' | 'sms'>('basic');

  // 配置表单
  const [basicConfig, setBasicConfig] = useState({
    siteName: '',
    siteTitle: '',
    siteDescription: '',
    siteKeywords: '',
    contactPhone: '',
    contactEmail: '',
  });

  const [paymentConfig, setPaymentConfig] = useState({
    alipayAppId: '',
    alipayPrivateKey: '',
    alipayPublicKey: '',
    wechatAppId: '',
    wechatMchId: '',
    wechatPayKey: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    aliyunAccessKeyId: '',
    aliyunAccessKeySecret: '',
    aliyunSignName: '',
    aliyunTemplateCode: '',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await adminApi.getConfigs();
      setConfigs(res);

      // 解析配置到表单
      res.forEach((config: SystemConfig) => {
        if (config.configType === 'basic') {
          if (config.configKey === 'site_name') setBasicConfig(prev => ({ ...prev, siteName: config.configValue }));
          if (config.configKey === 'site_title') setBasicConfig(prev => ({ ...prev, siteTitle: config.configValue }));
          if (config.configKey === 'site_description') setBasicConfig(prev => ({ ...prev, siteDescription: config.configValue }));
          if (config.configKey === 'site_keywords') setBasicConfig(prev => ({ ...prev, siteKeywords: config.configValue }));
          if (config.configKey === 'contact_phone') setBasicConfig(prev => ({ ...prev, contactPhone: config.configValue }));
          if (config.configKey === 'contact_email') setBasicConfig(prev => ({ ...prev, contactEmail: config.configValue }));
        }
        if (config.configType === 'payment') {
          if (config.configKey === 'alipay_app_id') setPaymentConfig(prev => ({ ...prev, alipayAppId: config.configValue }));
          if (config.configKey === 'alipay_private_key') setPaymentConfig(prev => ({ ...prev, alipayPrivateKey: config.configValue }));
          if (config.configKey === 'alipay_public_key') setPaymentConfig(prev => ({ ...prev, alipayPublicKey: config.configValue }));
          if (config.configKey === 'wechat_app_id') setPaymentConfig(prev => ({ ...prev, wechatAppId: config.configValue }));
          if (config.configKey === 'wechat_mch_id') setPaymentConfig(prev => ({ ...prev, wechatMchId: config.configValue }));
          if (config.configKey === 'wechat_pay_key') setPaymentConfig(prev => ({ ...prev, wechatPayKey: config.configValue }));
        }
        if (config.configType === 'sms') {
          if (config.configKey === 'aliyun_access_key_id') setSmsConfig(prev => ({ ...prev, aliyunAccessKeyId: config.configValue }));
          if (config.configKey === 'aliyun_access_key_secret') setSmsConfig(prev => ({ ...prev, aliyunAccessKeySecret: config.configValue }));
          if (config.configKey === 'aliyun_sign_name') setSmsConfig(prev => ({ ...prev, aliyunSignName: config.configValue }));
          if (config.configKey === 'aliyun_template_code') setSmsConfig(prev => ({ ...prev, aliyunTemplateCode: config.configValue }));
        }
      });
    } catch (error) {
      console.error('加载配置失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasic = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('site_name', basicConfig.siteName),
        adminApi.updateConfig('site_title', basicConfig.siteTitle),
        adminApi.updateConfig('site_description', basicConfig.siteDescription),
        adminApi.updateConfig('site_keywords', basicConfig.siteKeywords),
        adminApi.updateConfig('contact_phone', basicConfig.contactPhone),
        adminApi.updateConfig('contact_email', basicConfig.contactEmail),
      ]);
      alert('保存成功');
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('alipay_app_id', paymentConfig.alipayAppId),
        adminApi.updateConfig('alipay_private_key', paymentConfig.alipayPrivateKey),
        adminApi.updateConfig('alipay_public_key', paymentConfig.alipayPublicKey),
        adminApi.updateConfig('wechat_app_id', paymentConfig.wechatAppId),
        adminApi.updateConfig('wechat_mch_id', paymentConfig.wechatMchId),
        adminApi.updateConfig('wechat_pay_key', paymentConfig.wechatPayKey),
      ]);
      alert('保存成功');
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSms = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('aliyun_access_key_id', smsConfig.aliyunAccessKeyId),
        adminApi.updateConfig('aliyun_access_key_secret', smsConfig.aliyunAccessKeySecret),
        adminApi.updateConfig('aliyun_sign_name', smsConfig.aliyunSignName),
        adminApi.updateConfig('aliyun_template_code', smsConfig.aliyunTemplateCode),
      ]);
      alert('保存成功');
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const tabs = [
    { id: 'basic', label: '基础配置', icon: Icons.Settings },
    { id: 'payment', label: '支付配置', icon: Icons.CreditCard },
    { id: 'sms', label: '短信配置', icon: Icons.MessageSquare },
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">系统配置</h2>

      <div className="flex gap-4 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'basic' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">网站基础配置</h3>
          <div className="space-y-4 max-w-2xl">
            <Input label="网站名称" value={basicConfig.siteName} onChange={e => setBasicConfig({ ...basicConfig, siteName: e.target.value })} placeholder="云端牧场" />
            <Input label="网站标题" value={basicConfig.siteTitle} onChange={e => setBasicConfig({ ...basicConfig, siteTitle: e.target.value })} placeholder="云端牧场 - 智慧农业领养平台" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">网站描述 (SEO)</label>
              <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none" rows={3} value={basicConfig.siteDescription} onChange={e => setBasicConfig({ ...basicConfig, siteDescription: e.target.value })} placeholder="网站描述，用于SEO优化" />
            </div>
            <Input label="网站关键词 (SEO)" value={basicConfig.siteKeywords} onChange={e => setBasicConfig({ ...basicConfig, siteKeywords: e.target.value })} placeholder="云端牧场,智慧农业,活体领养" />
            <Input label="联系电话" value={basicConfig.contactPhone} onChange={e => setBasicConfig({ ...basicConfig, contactPhone: e.target.value })} placeholder="400-xxx-xxxx" />
            <Input label="联系邮箱" value={basicConfig.contactEmail} onChange={e => setBasicConfig({ ...basicConfig, contactEmail: e.target.value })} placeholder="contact@example.com" />
            <div className="pt-4">
              <Button onClick={handleSaveBasic} loading={saving}>保存配置</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">支付宝支付配置</h3>
            <div className="space-y-4 max-w-2xl">
              <Input label="App ID" value={paymentConfig.alipayAppId} onChange={e => setPaymentConfig({ ...paymentConfig, alipayAppId: e.target.value })} placeholder="支付宝应用ID" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">应用私钥</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none font-mono text-xs" rows={4} value={paymentConfig.alipayPrivateKey} onChange={e => setPaymentConfig({ ...paymentConfig, alipayPrivateKey: e.target.value })} placeholder="支付宝应用私钥" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">支付宝公钥</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none font-mono text-xs" rows={4} value={paymentConfig.alipayPublicKey} onChange={e => setPaymentConfig({ ...paymentConfig, alipayPublicKey: e.target.value })} placeholder="支付宝公钥" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">微信支付配置</h3>
            <div className="space-y-4 max-w-2xl">
              <Input label="App ID" value={paymentConfig.wechatAppId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatAppId: e.target.value })} placeholder="微信应用ID" />
              <Input label="商户号" value={paymentConfig.wechatMchId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatMchId: e.target.value })} placeholder="微信商户号" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">支付密钥</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none font-mono text-xs" rows={4} value={paymentConfig.wechatPayKey} onChange={e => setPaymentConfig({ ...paymentConfig, wechatPayKey: e.target.value })} placeholder="微信支付密钥" />
              </div>
              <div className="pt-4">
                <Button onClick={handleSavePayment} loading={saving}>保存支付配置</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'sms' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">阿里云短信配置</h3>
          <div className="space-y-4 max-w-2xl">
            <Input label="Access Key ID" value={smsConfig.aliyunAccessKeyId} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeyId: e.target.value })} placeholder="阿里云 Access Key ID" />
            <Input label="Access Key Secret" value={smsConfig.aliyunAccessKeySecret} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeySecret: e.target.value })} placeholder="阿里云 Access Key Secret" type="password" />
            <Input label="短信签名" value={smsConfig.aliyunSignName} onChange={e => setSmsConfig({ ...smsConfig, aliyunSignName: e.target.value })} placeholder="短信签名名称" />
            <Input label="短信模板Code" value={smsConfig.aliyunTemplateCode} onChange={e => setSmsConfig({ ...smsConfig, aliyunTemplateCode: e.target.value })} placeholder="短信模板Code" />
            <div className="pt-4">
              <Button onClick={handleSaveSms} loading={saving}>保存短信配置</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ==================== 后台管理主页面 ====================

interface AdminPageProps {
  activeMenu?: string;
}

const AdminPage: React.FC<AdminPageProps> = ({ activeMenu: initialMenu }) => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState(initialMenu || 'dashboard');
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const info = localStorage.getItem('admin_info');
    if (!token) {
      navigate('/admin-login');
      return;
    }
    if (info) {
      try {
        setAdminInfo(JSON.parse(info));
      } catch (e) {
        console.error('解析管理员信息失败', e);
      }
    }
    setLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.href = '/admin-login';
  };

  const handleMenuChange = (menu: string) => {
    setActiveMenu(menu);
  };

  if (loading) return <LoadingSpinner />;

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'livestock':
        return <AdminLivestock />;
      case 'orders':
        return <AdminOrders />;
      case 'feed':
        return <AdminFeedBills />;
      case 'redemption':
        return <AdminRedemptions />;
      case 'users':
        return <AdminUsers />;
      case 'config':
        return <AdminConfig />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <PageTransition>
      <AdminLayout activeMenu={activeMenu} onMenuChange={handleMenuChange} adminInfo={adminInfo} onLogout={handleLogout}>
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-30">
          <h2 className="text-lg font-bold text-slate-900">
            {activeMenu === 'dashboard' && '控制台'}
            {activeMenu === 'livestock' && '活体管理'}
            {activeMenu === 'orders' && '订单管理'}
            {activeMenu === 'feed' && '饲料费管理'}
            {activeMenu === 'redemption' && '买断管理'}
            {activeMenu === 'users' && '用户管理'}
            {activeMenu === 'config' && '系统配置'}
          </h2>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full relative">
              <Icons.Bell className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </AdminLayout>
    </PageTransition>
  );
};

export default AdminPage;
