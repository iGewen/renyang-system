import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, StatCard, Modal, Input, ConfirmDialog, EmptyState, ToastProvider, useToast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adminApi, refundApi } from '../../services/api';
import type { Livestock, LivestockType, AdoptionOrder, FeedBill, User, DashboardStats, SystemConfig, AuditLog, Notification } from '../../types';
import { OrderStatus, UserStatus, FeedBillStatus, RedemptionStatus, getOrderStatusText, getUserStatusText, getFeedBillStatusText, getRedemptionStatusText } from '../../types/enums';
import { AdminLayout } from './AdminLayout';

// ==================== 防抖 Hook ====================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ==================== 敏感文本区域组件 ====================

const SensitiveTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 4 }) => {
  const [visible, setVisible] = useState(false);

  const maskValue = (val: string) => {
    if (!val || val.length === 0) return '';
    if (val.length <= 8) return '••••••••';
    return val.substring(0, 4) + '••••••••' + val.substring(val.length - 4);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="text-xs text-brand-primary hover:underline flex items-center gap-1"
        >
          {visible ? (
            <>
              <Icons.EyeOff className="w-3.5 h-3.5" /> 隐藏
            </>
          ) : (
            <>
              <Icons.Eye className="w-3.5 h-3.5" /> 显示
            </>
          )}
        </button>
      </div>
      {visible ? (
        <textarea
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none font-mono text-xs"
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 overflow-hidden"
          style={{ minHeight: `${rows * 24 + 24}px` }}
        >
          {maskValue(value) || placeholder || '••••••••'}
        </div>
      )}
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
  const toast = useToast();
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
      toast.success('保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('确定要删除此类型吗？')) return;
    try {
      await adminApi.deleteLivestockType(id);
      setTypes(types.filter(t => t.id !== id));
      toast.success('删除成功');
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  const handleSaveLivestock = async () => {
    try {
      const data = {
        name: livestockForm.name,
        typeId: livestockForm.typeId,
        price: parseFloat(livestockForm.price),
        monthlyFeedFee: parseFloat(livestockForm.monthlyFeedFee),
        redemptionMonths: parseInt(livestockForm.redemptionMonths),
        stock: parseInt(livestockForm.stock),
        description: livestockForm.description,
        mainImage: livestockForm.image || undefined,
        images: livestockForm.image ? [livestockForm.image] : [],
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
      toast.success('保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: any) => {
    try {
      const newStatus = currentStatus === 1 || currentStatus === 'on_sale' ? 'off_sale' : 'on_sale';
      await adminApi.updateLivestockStatus(id, newStatus);
      setLivestock(livestock.map(l => l.id === id ? { ...l, status: newStatus } : l));
      toast.success('状态更新成功');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleDeleteLivestock = async (id: string) => {
    if (!window.confirm('确定要删除这个活体吗？')) return;
    try {
      await adminApi.deleteLivestock(id);
      setLivestock(livestock.filter(l => l.id !== id));
      toast.success('删除成功');
    } catch (error: any) {
      toast.error(error.message || '删除失败');
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
                    <Badge variant={item.status === 1 || item.status === 'on_sale' ? 'success' : 'default'}>
                      {item.status === 1 || item.status === 'on_sale' ? '在售' : '下架'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingLivestock(item); setLivestockForm({ name: item.name, typeId: item.typeId, price: String(item.price), monthlyFeedFee: String(item.monthlyFeedFee), redemptionMonths: String(item.redemptionMonths || 12), stock: String(item.stock), description: item.description || '', image: item.mainImage || '' }); setShowLivestockModal(true); }} className="text-brand-primary text-sm">编辑</button>
                      <button onClick={() => handleToggleStatus(item.id, item.status)} className="text-blue-600 text-sm">
                        {item.status === 1 || item.status === 'on_sale' ? '下架' : '上架'}
                      </button>
                      <button onClick={() => handleDeleteLivestock(item.id)} className="text-red-500 text-sm">删除</button>
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
  const toast = useToast();
  const [orders, setOrders] = useState<AdoptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdoptionOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getOrders({ status: statusFilter || undefined });
      setOrders(res.list || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleViewDetail = async (orderId: string) => {
    try {
      const order = await adminApi.getOrderById(orderId);
      setSelectedOrder(order);
      setShowDetail(true);
    } catch (error: any) {
      toast.error(error.message || '获取订单详情失败');
    }
  };

  const handleRefund = async () => {
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      toast.error('请输入退款原因');
      return;
    }
    setProcessing(true);
    try {
      await refundApi.apply({
        orderType: 'adoption',
        orderId: selectedOrder.id,
        reason: refundReason
      });
      toast.success('退款申请已提交');
      setShowRefund(false);
      setRefundReason('');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || '退款申请失败');
    } finally {
      setProcessing(false);
    }
  };

  // 订单状态映射 - 使用数字枚举
  const orderStatusMap: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    [OrderStatus.PENDING_PAYMENT]: { label: '待支付', variant: 'warning' },
    [OrderStatus.PAID]: { label: '已支付', variant: 'success' },
    [OrderStatus.CANCELLED]: { label: '已取消', variant: 'default' },
    [OrderStatus.REFUNDED]: { label: '已退款', variant: 'info' },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">订单管理</h2>
        <div className="flex gap-2">
          {[0, OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.REFUNDED].map(status => (
            <button key={status} onClick={() => setStatusFilter(status === 0 ? '' : String(status))} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === (status === 0 ? '' : String(status)) ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === 0 ? '全部' : orderStatusMap[status]?.label || '未知'}
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
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
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
                    <Badge variant={orderStatusMap[order.status as number]?.variant || 'default'}>{orderStatusMap[order.status as number]?.label || order.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetail(order.id)}>详情</Button>
                      {order.status === OrderStatus.PAID && (
                        <Button size="sm" variant="danger" onClick={() => { setSelectedOrder(order); setShowRefund(true); }}>退款</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState icon={<Icons.ShoppingCart className="w-12 h-12" />} title="暂无订单数据" />}
        </div>
      </Card>

      {/* 订单详情弹窗 */}
      {showDetail && selectedOrder && (
        <Modal open={showDetail} onClose={() => setShowDetail(false)} title="订单详情">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">订单号</p>
                <p className="font-mono">{selectedOrder.orderNo}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">状态</p>
                <Badge variant={orderStatusMap[selectedOrder.status as number]?.variant || 'default'}>
                  {orderStatusMap[selectedOrder.status as number]?.label || selectedOrder.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-500">活体名称</p>
                <p>{selectedOrder.livestock?.name || selectedOrder.livestockSnapshot?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">活体编号</p>
                <p className="font-mono">{selectedOrder.livestockId || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">用户手机</p>
                <p>{selectedOrder.user?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">用户昵称</p>
                <p>{selectedOrder.user?.nickname || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">订单金额</p>
                <p className="text-lg font-bold text-brand-primary">¥{selectedOrder.totalAmount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">支付方式</p>
                <p>{selectedOrder.paymentMethod === 'alipay' ? '支付宝' : selectedOrder.paymentMethod === 'wechat' ? '微信支付' : selectedOrder.paymentMethod || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">支付时间</p>
                <p>{selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleString() : '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-500">创建时间</p>
                <p>{new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDetail(false)}>关闭</Button>
              {selectedOrder.status === OrderStatus.PAID && (
                <Button onClick={() => { setShowDetail(false); setShowRefund(true); }}>申请退款</Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 退款弹窗 */}
      {showRefund && selectedOrder && (
        <Modal open={showRefund} onClose={() => { setShowRefund(false); setRefundReason(''); }} title="申请退款">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-2">订单信息</p>
              <p className="font-mono">{selectedOrder.orderNo}</p>
              <p className="text-lg font-bold text-brand-primary mt-1">¥{selectedOrder.totalAmount}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-2">退款原因</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                rows={3}
                placeholder="请输入退款原因"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowRefund(false); setRefundReason(''); }}>取消</Button>
              <Button onClick={handleRefund} loading={processing}>确认退款</Button>
            </div>
          </div>
        </Modal>
      )}
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

  // 饲料费状态映射 - 使用数字枚举
  const feedBillStatusMap: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    [FeedBillStatus.PENDING]: { label: '待支付', variant: 'warning' },
    [FeedBillStatus.PAID]: { label: '已支付', variant: 'success' },
    [FeedBillStatus.OVERDUE]: { label: '已逾期', variant: 'danger' },
    [FeedBillStatus.WAIVED]: { label: '已豁免', variant: 'default' },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">饲料费管理</h2>
        <div className="flex gap-2">
          {[0, FeedBillStatus.PENDING, FeedBillStatus.PAID, FeedBillStatus.OVERDUE].map(status => (
            <button key={status} onClick={() => setStatusFilter(status === 0 ? '' : String(status))} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === (status === 0 ? '' : String(status)) ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === 0 ? '全部' : feedBillStatusMap[status]?.label || '未知'}
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
                    <Badge variant={feedBillStatusMap[bill.status as number]?.variant || 'default'}>{feedBillStatusMap[bill.status as number]?.label || bill.status}</Badge>
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
  const toast = useToast();
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    adminApi.getRedemptions({ status: statusFilter || undefined })
      .then(res => setRedemptions(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  // 买断状态映射 - 使用数字枚举
  const redemptionStatusMap: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    [RedemptionStatus.PENDING_AUDIT]: { label: '待审核', variant: 'warning' },
    [RedemptionStatus.AUDIT_PASSED]: { label: '审核通过', variant: 'success' },
    [RedemptionStatus.AUDIT_REJECTED]: { label: '审核拒绝', variant: 'danger' },
    [RedemptionStatus.PAID]: { label: '已支付', variant: 'info' },
    [RedemptionStatus.CANCELLED]: { label: '已取消', variant: 'default' },
  };

  const handleAudit = async (id: string, approved: boolean) => {
    try {
      await adminApi.auditRedemption(id, { approved });
      const res = await adminApi.getRedemptions({ status: statusFilter || undefined });
      setRedemptions(res.list || []);
      toast.success(approved ? '已通过审核' : '已拒绝');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">买断管理</h2>
        <div className="flex gap-2">
          {[0, RedemptionStatus.PENDING_AUDIT, RedemptionStatus.AUDIT_PASSED, RedemptionStatus.AUDIT_REJECTED].map(status => (
            <button key={status} onClick={() => setStatusFilter(status === 0 ? '' : String(status))} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', statusFilter === (status === 0 ? '' : String(status)) ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {status === 0 ? '全部' : redemptionStatusMap[status]?.label || '未知'}
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
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户手机</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">活体编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map(item => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{item.redemptionNo}</td>
                  <td className="py-3 px-4">{item.user?.phone || '-'}</td>
                  <td className="py-3 px-4">{item.livestock?.name || item.livestockId || '-'}</td>
                  <td className="py-3 px-4">¥{item.finalAmount || item.originalAmount || 0}</td>
                  <td className="py-3 px-4">
                    <Badge variant={redemptionStatusMap[item.status as number]?.variant || 'default'}>{redemptionStatusMap[item.status as number]?.label || item.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {item.status === RedemptionStatus.PENDING_AUDIT && (
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
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  // 弹窗状态
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newStatus, setNewStatus] = useState<number>(1);
  const [editForm, setEditForm] = useState({ nickname: '', phone: '' });
  const [balanceForm, setBalanceForm] = useState({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // 搜索防抖
  const debouncedKeyword = useDebounce(keyword, 500);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({ keyword: debouncedKeyword || undefined });
      setUsers(res.list || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [debouncedKeyword]);

  // 用户状态映射 - 使用数字枚举
  const userStatusMap: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    [UserStatus.NORMAL]: { label: '正常', variant: 'success' },
    [UserStatus.RESTRICTED]: { label: '受限', variant: 'warning' },
    [UserStatus.BANNED]: { label: '封禁', variant: 'danger' },
  };

  const handleStatusChange = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await adminApi.updateUserStatus(selectedUser.id, newStatus);
      toast.success('状态更新成功');
      setShowStatusModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await adminApi.updateUserInfo(selectedUser.id, editForm);
      toast.success('用户信息更新成功');
      setShowEditModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 余额调整限制
  const BALANCE_ADJUST_MIN = -10000; // 最大扣减金额
  const BALANCE_ADJUST_MAX = 10000;  // 最大增加金额

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    const amount = parseFloat(balanceForm.amount);
    if (isNaN(amount) || amount === 0) {
      toast.error('请输入有效的金额');
      return;
    }
    // 金额限制检查
    if (amount < BALANCE_ADJUST_MIN) {
      toast.error(`单次扣减金额不能超过 ¥${Math.abs(BALANCE_ADJUST_MIN).toLocaleString()}`);
      return;
    }
    if (amount > BALANCE_ADJUST_MAX) {
      toast.error(`单次增加金额不能超过 ¥${BALANCE_ADJUST_MAX.toLocaleString()}`);
      return;
    }
    // 检查扣减后余额是否为负
    const currentBalance = typeof selectedUser.balance === 'number'
      ? selectedUser.balance
      : parseFloat(selectedUser.balance || '0');
    if (currentBalance + amount < 0) {
      toast.error('扣减后余额不能为负数');
      return;
    }
    if (!balanceForm.reason.trim()) {
      toast.error('请填写调整原因');
      return;
    }
    if (balanceForm.reason.trim().length < 5) {
      toast.error('调整原因至少需要5个字符');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.adjustUserBalance(selectedUser.id, amount, balanceForm.reason);
      toast.success('余额调整成功');
      setShowBalanceModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusModal = (user: User) => {
    setSelectedUser(user);
    setNewStatus(user.status);
    setShowStatusModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({ nickname: user.nickname || '', phone: user.phone });
    setShowEditModal(true);
  };

  const openBalanceModal = (user: User) => {
    setSelectedUser(user);
    setBalanceForm({ amount: '', reason: '' });
    setShowBalanceModal(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">用户管理</h2>
        <Input placeholder="搜索用户（手机号/昵称）" value={keyword} onChange={e => setKeyword(e.target.value)} icon={<Icons.Search className="w-5 h-5" />} className="w-64" />
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
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{user.id?.substring(0, 8)}</td>
                  <td className="py-3 px-4">{user.phone}</td>
                  <td className="py-3 px-4">{user.nickname || '-'}</td>
                  <td className="py-3 px-4 font-medium">¥{typeof user.balance === 'number' ? user.balance.toFixed(2) : parseFloat(user.balance || '0').toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <Badge variant={userStatusMap[user.status as number]?.variant || 'default'}>{userStatusMap[user.status as number]?.label || user.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => openStatusModal(user)} className="text-blue-600 text-sm hover:underline">状态</button>
                      <button onClick={() => openEditModal(user)} className="text-brand-primary text-sm hover:underline">编辑</button>
                      <button onClick={() => openBalanceModal(user)} className="text-green-600 text-sm hover:underline">调余额</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState icon={<Icons.Users className="w-12 h-12" />} title="暂无用户数据" />}
        </div>
      </Card>

      {/* 状态修改弹窗 */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="修改用户状态">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">用户：{selectedUser?.phone} ({selectedUser?.nickname || '未设置昵称'})</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">选择状态</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={newStatus}
              onChange={e => setNewStatus(Number(e.target.value))}
            >
              <option value={1}>正常</option>
              <option value={2}>受限</option>
              <option value={3}>封禁</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleStatusChange} loading={submitting}>确认</Button>
          </div>
        </div>
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="编辑用户信息">
        <div className="p-6 space-y-4">
          <Input
            label="手机号"
            value={editForm.phone}
            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
            placeholder="请输入手机号"
          />
          <Input
            label="昵称"
            value={editForm.nickname}
            onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
            placeholder="请输入昵称"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleEditUser} loading={submitting}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* 调整余额弹窗 */}
      <Modal open={showBalanceModal} onClose={() => setShowBalanceModal(false)} title="调整用户余额">
        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500">当前余额</p>
            <p className="text-2xl font-bold text-brand-primary">
              ¥{typeof selectedUser?.balance === 'number' ? selectedUser.balance.toFixed(2) : parseFloat(selectedUser?.balance || '0').toFixed(2)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">调整金额</label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={balanceForm.amount}
              onChange={e => setBalanceForm({ ...balanceForm, amount: e.target.value })}
              placeholder="正数为增加，负数为扣减"
            />
            <p className="text-xs text-slate-400 mt-1">
              单次限额：增加 ¥10,000 / 扣减 ¥10,000
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">调整原因 <span className="text-red-500">*</span></label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
              rows={3}
              value={balanceForm.reason}
              onChange={e => setBalanceForm({ ...balanceForm, reason: e.target.value })}
              placeholder="请输入调整原因（至少5个字符）"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowBalanceModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleAdjustBalance} loading={submitting}>确认调整</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ==================== 系统配置 ====================

export const AdminConfig: React.FC = () => {
  const toast = useToast();
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
    alipayNotifyUrl: '',
    alipayReturnUrl: '',
    wechatAppId: '',
    wechatMchId: '',
    wechatPayKey: '',
    wechatApiV3Key: '',
    wechatSerialNo: '',
    wechatPrivateKey: '',
    wechatNotifyUrl: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    aliyunAccessKeyId: '',
    aliyunAccessKeySecret: '',
    aliyunSignName: '',
    // 短信模板
    smsTemplateLogin: '',        // 登录验证码
    smsTemplateRegister: '',     // 注册验证码
    smsTemplateResetPassword: '',// 找回密码验证码
    smsTemplateOrder: '',        // 订单通知
    smsTemplateFeedBill: '',     // 饲料费通知
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await adminApi.getConfigs();
      setConfigs(res);

      // 解析配置到表单 - 不依赖configType，直接按key匹配
      // 确保 configValue 不为 null 或 undefined
      res.forEach((config: SystemConfig) => {
        const value = config.configValue || '';
        // 基础配置
        if (config.configKey === 'site_name') setBasicConfig(prev => ({ ...prev, siteName: value }));
        if (config.configKey === 'site_title') setBasicConfig(prev => ({ ...prev, siteTitle: value }));
        if (config.configKey === 'site_description') setBasicConfig(prev => ({ ...prev, siteDescription: value }));
        if (config.configKey === 'site_keywords') setBasicConfig(prev => ({ ...prev, siteKeywords: value }));
        if (config.configKey === 'contact_phone') setBasicConfig(prev => ({ ...prev, contactPhone: value }));
        if (config.configKey === 'contact_email') setBasicConfig(prev => ({ ...prev, contactEmail: value }));

        // 支付配置
        if (config.configKey === 'alipay_app_id') setPaymentConfig(prev => ({ ...prev, alipayAppId: value }));
        if (config.configKey === 'alipay_private_key') setPaymentConfig(prev => ({ ...prev, alipayPrivateKey: value }));
        if (config.configKey === 'alipay_public_key') setPaymentConfig(prev => ({ ...prev, alipayPublicKey: value }));
        if (config.configKey === 'alipay_notify_url') setPaymentConfig(prev => ({ ...prev, alipayNotifyUrl: value }));
        if (config.configKey === 'alipay_return_url') setPaymentConfig(prev => ({ ...prev, alipayReturnUrl: value }));
        if (config.configKey === 'wechat_app_id') setPaymentConfig(prev => ({ ...prev, wechatAppId: value }));
        if (config.configKey === 'wechat_mch_id') setPaymentConfig(prev => ({ ...prev, wechatMchId: value }));
        if (config.configKey === 'wechat_pay_key') setPaymentConfig(prev => ({ ...prev, wechatPayKey: value }));
        if (config.configKey === 'wechat_api_v3_key') setPaymentConfig(prev => ({ ...prev, wechatApiV3Key: value }));
        if (config.configKey === 'wechat_serial_no') setPaymentConfig(prev => ({ ...prev, wechatSerialNo: value }));
        if (config.configKey === 'wechat_private_key') setPaymentConfig(prev => ({ ...prev, wechatPrivateKey: value }));
        if (config.configKey === 'wechat_notify_url') setPaymentConfig(prev => ({ ...prev, wechatNotifyUrl: value }));

        // 短信配置
        if (config.configKey === 'aliyun_access_key_id') setSmsConfig(prev => ({ ...prev, aliyunAccessKeyId: value }));
        if (config.configKey === 'aliyun_access_key_secret') setSmsConfig(prev => ({ ...prev, aliyunAccessKeySecret: value }));
        if (config.configKey === 'aliyun_sign_name') setSmsConfig(prev => ({ ...prev, aliyunSignName: value }));
        if (config.configKey === 'sms_template_login') setSmsConfig(prev => ({ ...prev, smsTemplateLogin: value }));
        if (config.configKey === 'sms_template_register') setSmsConfig(prev => ({ ...prev, smsTemplateRegister: value }));
        if (config.configKey === 'sms_template_reset_password') setSmsConfig(prev => ({ ...prev, smsTemplateResetPassword: value }));
        if (config.configKey === 'sms_template_order') setSmsConfig(prev => ({ ...prev, smsTemplateOrder: value }));
        if (config.configKey === 'sms_template_feed_bill') setSmsConfig(prev => ({ ...prev, smsTemplateFeedBill: value }));
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
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
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
        adminApi.updateConfig('alipay_notify_url', paymentConfig.alipayNotifyUrl),
        adminApi.updateConfig('alipay_return_url', paymentConfig.alipayReturnUrl),
        adminApi.updateConfig('wechat_app_id', paymentConfig.wechatAppId),
        adminApi.updateConfig('wechat_mch_id', paymentConfig.wechatMchId),
        adminApi.updateConfig('wechat_pay_key', paymentConfig.wechatPayKey),
        adminApi.updateConfig('wechat_api_v3_key', paymentConfig.wechatApiV3Key),
        adminApi.updateConfig('wechat_serial_no', paymentConfig.wechatSerialNo),
        adminApi.updateConfig('wechat_private_key', paymentConfig.wechatPrivateKey),
        adminApi.updateConfig('wechat_notify_url', paymentConfig.wechatNotifyUrl),
      ]);
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
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
        // 短信模板
        adminApi.updateConfig('sms_template_login', smsConfig.smsTemplateLogin),
        adminApi.updateConfig('sms_template_register', smsConfig.smsTemplateRegister),
        adminApi.updateConfig('sms_template_reset_password', smsConfig.smsTemplateResetPassword),
        adminApi.updateConfig('sms_template_order', smsConfig.smsTemplateOrder),
        adminApi.updateConfig('sms_template_feed_bill', smsConfig.smsTemplateFeedBill),
      ]);
      toast.success('保存成功');
      // 保存成功后重新加载配置
      await loadConfigs();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
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
            <h3 className="text-lg font-bold text-slate-900 mb-4">支付宝支付配置（H5支付）</h3>
            <div className="space-y-4 max-w-2xl">
              <Input label="App ID" value={paymentConfig.alipayAppId} onChange={e => setPaymentConfig({ ...paymentConfig, alipayAppId: e.target.value })} placeholder="支付宝应用ID" />
              <SensitiveTextarea
                label="应用私钥"
                value={paymentConfig.alipayPrivateKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, alipayPrivateKey: value })}
                placeholder="支付宝应用私钥（RSA2格式）"
                rows={4}
              />
              <SensitiveTextarea
                label="支付宝公钥"
                value={paymentConfig.alipayPublicKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, alipayPublicKey: value })}
                placeholder="支付宝公钥（用于验签）"
                rows={4}
              />
              <Input label="支付回调URL" value={paymentConfig.alipayNotifyUrl} onChange={e => setPaymentConfig({ ...paymentConfig, alipayNotifyUrl: e.target.value })} placeholder="https://example.com/api/payment/alipay/notify" />
              <Input label="支付返回URL" value={paymentConfig.alipayReturnUrl} onChange={e => setPaymentConfig({ ...paymentConfig, alipayReturnUrl: e.target.value })} placeholder="https://example.com/payment/result" />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">微信支付配置（H5支付）</h3>
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <Input label="App ID" value={paymentConfig.wechatAppId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatAppId: e.target.value })} placeholder="微信应用ID" />
                <Input label="商户号" value={paymentConfig.wechatMchId} onChange={e => setPaymentConfig({ ...paymentConfig, wechatMchId: e.target.value })} placeholder="微信商户号" />
              </div>
              <SensitiveTextarea
                label="商户API密钥（V2）"
                value={paymentConfig.wechatPayKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatPayKey: value })}
                placeholder="微信支付V2密钥（32位）"
                rows={2}
              />
              <SensitiveTextarea
                label="API V3密钥"
                value={paymentConfig.wechatApiV3Key}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatApiV3Key: value })}
                placeholder="微信支付V3密钥（32位）"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="商户证书序列号" value={paymentConfig.wechatSerialNo} onChange={e => setPaymentConfig({ ...paymentConfig, wechatSerialNo: e.target.value })} placeholder="商户API证书序列号" />
                <Input label="支付回调URL" value={paymentConfig.wechatNotifyUrl} onChange={e => setPaymentConfig({ ...paymentConfig, wechatNotifyUrl: e.target.value })} placeholder="https://example.com/api/payment/wechat/notify" />
              </div>
              <SensitiveTextarea
                label="商户API私钥"
                value={paymentConfig.wechatPrivateKey}
                onChange={value => setPaymentConfig({ ...paymentConfig, wechatPrivateKey: value })}
                placeholder="商户API私钥（用于签名）"
                rows={4}
              />
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
            <div className="grid grid-cols-2 gap-4">
              <Input label="Access Key ID" value={smsConfig.aliyunAccessKeyId} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeyId: e.target.value })} placeholder="阿里云 Access Key ID" />
              <Input label="Access Key Secret" value={smsConfig.aliyunAccessKeySecret} onChange={e => setSmsConfig({ ...smsConfig, aliyunAccessKeySecret: e.target.value })} placeholder="阿里云 Access Key Secret" type="password" />
            </div>
            <Input label="短信签名" value={smsConfig.aliyunSignName} onChange={e => setSmsConfig({ ...smsConfig, aliyunSignName: e.target.value })} placeholder="短信签名名称，如：云端牧场" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4">短信模板配置</h3>
          <p className="text-sm text-slate-500 mb-4">
            请在阿里云短信控制台创建对应模板，填写模板CODE（如：SMS_123456789）
          </p>
          <div className="space-y-4 max-w-2xl">
            <Input
              label="登录验证码模板"
              value={smsConfig.smsTemplateLogin}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateLogin: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="注册验证码模板"
              value={smsConfig.smsTemplateRegister}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateRegister: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="找回密码验证码模板"
              value={smsConfig.smsTemplateResetPassword}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateResetPassword: e.target.value })}
              placeholder="模板CODE，变量：${code}"
            />
            <Input
              label="订单通知模板"
              value={smsConfig.smsTemplateOrder}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateOrder: e.target.value })}
              placeholder="模板CODE，变量：${orderNo}（认养编号）"
            />
            <Input
              label="饲料费通知模板"
              value={smsConfig.smsTemplateFeedBill}
              onChange={e => setSmsConfig({ ...smsConfig, smsTemplateFeedBill: e.target.value })}
              placeholder="模板CODE，变量：${orderNo}（认养编号）"
            />
            <div className="pt-4">
              <Button onClick={handleSaveSms} loading={saving}>保存短信配置</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ==================== 站内信管理 ====================

export const AdminNotifications: React.FC = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'system',
    userIds: '' as string,
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await adminApi.getNotifications({});
      setNotifications(res.list || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!formData.title || !formData.content) {
      toast.warning('请填写标题和内容');
      return;
    }

    setSending(true);
    try {
      await adminApi.sendNotification({
        title: formData.title,
        content: formData.content,
        type: formData.type,
        userIds: formData.userIds ? formData.userIds.split(',').map(s => s.trim()) : undefined,
      });
      toast.success('发送成功');
      setShowSendModal(false);
      setFormData({ title: '', content: '', type: 'system', userIds: '' });
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const typeMap: Record<string, { label: string; color: string }> = {
    system: { label: '系统', color: 'bg-purple-100 text-purple-600' },
    order: { label: '订单', color: 'bg-blue-100 text-blue-600' },
    feed: { label: '饲料费', color: 'bg-orange-100 text-orange-600' },
    redemption: { label: '买断', color: 'bg-green-100 text-green-600' },
    balance: { label: '余额', color: 'bg-cyan-100 text-cyan-600' },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">站内信管理</h2>
        <Button onClick={() => setShowSendModal(true)}>
          <Icons.Send className="w-4 h-4 mr-2" />
          发送通知
        </Button>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">标题</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">内容</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">接收用户</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(notification => (
                <tr key={notification.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(notification.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', typeMap[notification.type]?.color || 'bg-slate-100 text-slate-600')}>
                      {typeMap[notification.type]?.label || notification.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium">{notification.title}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 max-w-xs truncate">{notification.content}</td>
                  <td className="py-3 px-4 text-sm">{notification.userId ? '指定用户' : '全部用户'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {notifications.length === 0 && <EmptyState icon={<Icons.Bell className="w-12 h-12" />} title="暂无站内信" />}
        </div>
      </Card>

      <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title="发送站内信">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">通知类型</label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="system">系统通知</option>
              <option value="order">订单通知</option>
              <option value="feed">饲料费通知</option>
              <option value="redemption">买断通知</option>
              <option value="balance">余额通知</option>
            </select>
          </div>
          <Input
            label="标题"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="请输入通知标题"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">内容</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
              rows={4}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="请输入通知内容"
            />
          </div>
          <Input
            label="指定用户ID（选填，多个用逗号分隔）"
            value={formData.userIds}
            onChange={e => setFormData({ ...formData, userIds: e.target.value })}
            placeholder="留空则发送给所有用户"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSend} loading={sending}>发送</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ==================== 协议管理 ====================

interface Agreement {
  id: string;
  agreementKey: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const AdminAgreements: React.FC = () => {
  const toast = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    agreementKey: '',
    title: '',
    content: '',
  });

  // 预设协议类型
  const presetAgreements = [
    { key: 'user_agreement', title: '用户协议' },
    { key: 'adoption_agreement', title: '领养协议' },
    { key: 'privacy_policy', title: '隐私政策' },
    { key: 'disclaimer', title: '免责声明' },
  ];

  useEffect(() => {
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      const res = await adminApi.getAgreements();
      setAgreements(res || []);
    } catch (error) {
      console.error('Failed to load agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agreement?: Agreement) => {
    if (agreement) {
      setEditingKey(agreement.agreementKey);
      setFormData({
        agreementKey: agreement.agreementKey,
        title: agreement.title,
        content: agreement.content,
      });
    } else {
      setEditingKey(null);
      setFormData({
        agreementKey: '',
        title: '',
        content: '',
      });
    }
  };

  const handleSelectPreset = (key: string) => {
    const preset = presetAgreements.find(p => p.key === key);
    const existing = agreements.find(a => a.agreementKey === key);
    setEditingKey(key);
    setFormData({
      agreementKey: key,
      title: existing?.title || preset?.title || '',
      content: existing?.content || '',
    });
  };

  const handleSave = async () => {
    if (!formData.agreementKey || !formData.title || !formData.content) {
      toast.warning('请填写完整信息');
      return;
    }

    setSaving(true);
    try {
      await adminApi.saveAgreement(formData);
      toast.success('保存成功');
      setEditingKey(null);
      setFormData({ agreementKey: '', title: '', content: '' });
      loadAgreements();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('确定要删除该协议吗？')) return;

    try {
      await adminApi.deleteAgreement(key);
      toast.success('删除成功');
      loadAgreements();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">协议管理</h2>
        <Button onClick={() => handleEdit()}>
          <Icons.Plus className="w-4 h-4 mr-2" />
          添加协议
        </Button>
      </div>

      {/* 预设协议快捷入口 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-500 mb-3">快捷编辑</h3>
        <div className="flex flex-wrap gap-2">
          {presetAgreements.map(preset => {
            const existing = agreements.find(a => a.agreementKey === preset.key);
            return (
              <button
                key={preset.key}
                onClick={() => handleSelectPreset(preset.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  existing
                    ? 'bg-brand-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {preset.title}
                {existing && ' ✓'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 编辑表单 */}
      {editingKey !== null && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {agreements.find(a => a.agreementKey === editingKey) ? '编辑协议' : '添加协议'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="协议键名（英文标识）"
                value={formData.agreementKey}
                onChange={e => setFormData({ ...formData, agreementKey: e.target.value })}
                placeholder="如：user_agreement"
                disabled={!!agreements.find(a => a.agreementKey === editingKey)}
              />
              <Input
                label="协议标题"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="如：用户协议"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">协议内容</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
                rows={15}
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                placeholder="请输入协议内容，支持HTML格式"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditingKey(null)}>取消</Button>
              <Button onClick={handleSave} loading={saving}>保存</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 协议列表 */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">协议键名</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">标题</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">更新时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map(agreement => (
                <tr key={agreement.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{agreement.agreementKey}</td>
                  <td className="py-3 px-4 font-medium">{agreement.title}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {new Date(agreement.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(agreement)}
                        className="text-brand-primary hover:underline text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(agreement.agreementKey)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agreements.length === 0 && (
            <EmptyState icon={<Icons.FileText className="w-12 h-12" />} title="暂无协议" description="点击上方按钮添加协议" />
          )}
        </div>
      </Card>
    </div>
  );
};

// ==================== 审计日志 ====================

// 操作类型中文映射
const actionMap: Record<string, string> = {
  login: '登录',
  logout: '登出',
  create: '创建',
  update: '更新',
  delete: '删除',
  update_status: '修改状态',
  update_config: '修改配置',
  send: '发送',
  send_announcement: '发送公告',
  approve: '审核通过',
  reject: '审核拒绝',
  adjust: '调整',
  waive: '豁免',
};

// 模块中文映射
const moduleMapFull: Record<string, { label: string; color: string }> = {
  auth: { label: '认证', color: 'bg-purple-100 text-purple-600' },
  admin: { label: '管理员', color: 'bg-purple-100 text-purple-600' },
  user: { label: '用户', color: 'bg-blue-100 text-blue-600' },
  livestock: { label: '活体', color: 'bg-green-100 text-green-600' },
  livestock_type: { label: '活体类型', color: 'bg-green-100 text-green-600' },
  order: { label: '订单', color: 'bg-orange-100 text-orange-600' },
  adoption: { label: '领养', color: 'bg-yellow-100 text-yellow-600' },
  feed_bill: { label: '饲料费', color: 'bg-cyan-100 text-cyan-600' },
  redemption: { label: '买断', color: 'bg-pink-100 text-pink-600' },
  refund: { label: '退款', color: 'bg-red-100 text-red-600' },
  notification: { label: '通知', color: 'bg-indigo-100 text-indigo-600' },
  system_config: { label: '系统配置', color: 'bg-slate-100 text-slate-600' },
  agreement: { label: '协议', color: 'bg-teal-100 text-teal-600' },
  config: { label: '配置', color: 'bg-slate-100 text-slate-600' },
};

// 格式化IP地址（转换IPv6为IPv4）
const formatIp = (ip: string | undefined): string => {
  if (!ip) return '-';
  // 处理IPv6映射的IPv4地址 (如 ::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  // 处理本地回环地址
  if (ip === '::1' || ip === '::') {
    return '127.0.0.1';
  }
  return ip;
};

// 格式化JSON显示
const formatJson = (data: any): string => {
  if (!data) return '无';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export const AdminAuditLogs: React.FC = () => {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({ module: moduleFilter || undefined });
      setLogs(res.list || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [moduleFilter]);

  const handleClearLogs = async () => {
    if (!confirmPassword.trim()) {
      setPasswordError('请输入管理员密码');
      return;
    }
    setClearing(true);
    setPasswordError('');
    try {
      // 先验证密码
      await adminApi.verifyPassword(confirmPassword);
      // 密码正确，执行清空
      await adminApi.clearAuditLogs();
      toast.success('审计日志已清空');
      setShowClearConfirm(false);
      setConfirmPassword('');
      loadLogs();
    } catch (error: any) {
      if (error.message?.includes('密码') || error.status === 401) {
        setPasswordError('密码错误');
      } else {
        toast.error(error.message || '清空失败');
      }
    } finally {
      setClearing(false);
    }
  };

  const openClearConfirm = () => {
    setConfirmPassword('');
    setPasswordError('');
    setShowClearConfirm(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">审计日志</h2>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModuleFilter('')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                moduleFilter === '' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              全部
            </button>
            {Object.entries(moduleMapFull).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setModuleFilter(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  moduleFilter === key ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {value.label}
              </button>
            ))}
          </div>
          <Button variant="danger" onClick={openClearConfirm}>
            <Icons.Trash2 className="w-4 h-4 mr-2" />
            清空日志
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作人</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">模块</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">描述</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">IP地址</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{log.adminName || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', moduleMapFull[log.module]?.color || 'bg-slate-100 text-slate-600')}>
                      {moduleMapFull[log.module]?.label || log.module}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{actionMap[log.action] || log.action}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">{log.remark || '-'}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 font-mono">{formatIp(log.ip)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-brand-primary hover:underline text-sm"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <EmptyState icon={<Icons.FileText className="w-12 h-12" />} title="暂无审计日志" />}
        </div>
      </Card>

      {/* 清空确认弹窗 - 需要密码确认 */}
      <Modal open={showClearConfirm} onClose={() => { setShowClearConfirm(false); setConfirmPassword(''); setPasswordError(''); }} title="确认清空审计日志">
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50 rounded-xl">
            <div className="flex items-start gap-3">
              <Icons.AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">危险操作警告</p>
                <p className="text-sm text-red-600 mt-1">此操作将清空所有审计日志，且无法恢复。请输入管理员密码确认操作。</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">管理员密码</label>
            <input
              type="password"
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none",
                passwordError ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              )}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
              placeholder="请输入密码确认"
            />
            {passwordError && <p className="text-sm text-red-500 mt-1">{passwordError}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setShowClearConfirm(false); setConfirmPassword(''); setPasswordError(''); }}>取消</Button>
            <Button variant="danger" className="flex-1" onClick={handleClearLogs} loading={clearing}>确认清空</Button>
          </div>
        </div>
      </Modal>

      {/* 详情弹窗 */}
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="日志详情">
        {selectedLog && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500">时间</label>
                <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">操作人</label>
                <p className="font-medium">{selectedLog.adminName || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">模块</label>
                <p className="font-medium">{moduleMapFull[selectedLog.module]?.label || selectedLog.module}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">操作类型</label>
                <p className="font-medium">{actionMap[selectedLog.action] || selectedLog.action}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">IP地址</label>
                <p className="font-medium font-mono">{formatIp(selectedLog.ip)}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">敏感操作</label>
                <p className="font-medium">{selectedLog.isSensitive ? '是' : '否'}</p>
              </div>
            </div>
            {selectedLog.remark && (
              <div>
                <label className="text-sm text-slate-500">描述</label>
                <p className="font-medium">{selectedLog.remark}</p>
              </div>
            )}
            {selectedLog.beforeData && (
              <div>
                <label className="text-sm text-slate-500 block mb-2">修改前数据</label>
                <pre className="bg-slate-50 p-3 rounded-lg text-sm overflow-x-auto max-h-40">{formatJson(selectedLog.beforeData)}</pre>
              </div>
            )}
            {selectedLog.afterData && (
              <div>
                <label className="text-sm text-slate-500 block mb-2">修改后数据</label>
                <pre className="bg-slate-50 p-3 rounded-lg text-sm overflow-x-auto max-h-40">{formatJson(selectedLog.afterData)}</pre>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setSelectedLog(null)}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ==================== 后台管理主页面 ====================

interface AdminPageProps {
  activeMenu?: string;
}

const AdminPage: React.FC<AdminPageProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // 从 URL 路径中提取当前菜单，路径格式为 /admin/:menu
  const pathMenu = location.pathname.replace('/admin', '').replace('/', '') || 'dashboard';
  const [activeMenu, setActiveMenu] = useState(pathMenu);
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

  // 同步 URL 和菜单状态
  useEffect(() => {
    const pathMenu = location.pathname.replace('/admin', '').replace('/', '') || 'dashboard';
    if (pathMenu !== activeMenu) {
      setActiveMenu(pathMenu);
    }
  }, [location.pathname, activeMenu]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    window.location.href = '/admin-login';
  };

  const handleMenuChange = (menu: string) => {
    setActiveMenu(menu);
    // 更新 URL
    navigate(`/admin/${menu === 'dashboard' ? '' : menu}`, { replace: true });
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
      case 'notifications':
        return <AdminNotifications />;
      case 'agreements':
        return <AdminAgreements />;
      case 'logs':
        return <AdminAuditLogs />;
      case 'config':
        return <AdminConfig />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <ToastProvider>
      <PageTransition>
        <AdminLayout activeMenu={activeMenu} onMenuChange={handleMenuChange} adminInfo={adminInfo} onLogout={handleLogout}>
          {renderContent()}
        </AdminLayout>
      </PageTransition>
    </ToastProvider>
  );
};

export default AdminPage;
