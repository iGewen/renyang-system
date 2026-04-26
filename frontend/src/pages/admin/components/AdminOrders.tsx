import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Badge, Card, Modal, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { AdoptionOrder } from '../../../types';
import { OrderStatus } from '../../../types/enums';
import type { StatusVariant } from './admin-utils';

export const AdminOrders: React.FC = () => {
  const toast = useToast();
  const [orders, setOrders] = useState<AdoptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdoptionOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = async (keyword?: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getOrders({ status: statusFilter || undefined, keyword: keyword || searchKeyword || undefined });
      setOrders(res.list || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);
  useEffect(() => { const timer = setTimeout(() => fetchOrders(), 500); return () => clearTimeout(timer); }, [searchKeyword]);

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
    if (!refundReason.trim()) { toast.error('请输入退款原因'); return; }
    setProcessing(true);
    try {
      await adminApi.adminRefund({ userId: selectedOrder.userId, amount: Number(selectedOrder.totalAmount), reason: refundReason, orderType: 'adoption', orderId: selectedOrder.id });
      toast.success('退款成功');
      setShowRefund(false);
      setRefundReason('');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || '退款失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    if (deleteConfirmStep === 1) { setDeleteConfirmStep(2); return; }
    setDeleting(true);
    try {
      await adminApi.deleteOrder(selectedOrder.id);
      toast.success('订单已删除');
      setShowDeleteConfirm(false);
      setDeleteConfirmStep(1);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (order: AdoptionOrder) => { setSelectedOrder(order); setDeleteConfirmStep(1); setShowDeleteConfirm(true); };

  const orderStatusMap: Record<number, { label: string; variant: StatusVariant }> = {
    [OrderStatus.PENDING_PAYMENT]: { label: '待支付', variant: 'warning' },
    [OrderStatus.PAID]: { label: '已支付', variant: 'success' },
    [OrderStatus.CANCELLED]: { label: '已取消', variant: 'default' },
    [OrderStatus.REFUNDED]: { label: '已退款', variant: 'info' },
  };

  const getPaymentMethodText = (method: string | undefined): string => {
    if (method === 'alipay') return '支付宝';
    if (method === 'wechat') return '微信支付';
    if (method === 'balance') return '余额支付';
    return method || '-';
  };

  if (loading) return <LoadingSpinner />;

  const handleExportOrders = async () => {
    try {
      toast.info('正在导出订单数据...');
      const result = await adminApi.exportOrders({ status: statusFilter ? Number.parseInt(statusFilter) : undefined });
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
      link.download = result.filename;
      link.click();
      toast.success('导出成功');
    } catch (error: any) {
      toast.error(error.message || '导出失败');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="flex-1 flex gap-2">
          <Button size="sm" onClick={handleExportOrders} icon={<Icons.Download className="w-4 h-4" />}>导出Excel</Button>
          <div className="relative flex-1 max-w-xs">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜索订单号/用户手机" className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none text-sm" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          {[0, OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.REFUNDED].map(status => {
            const filterValue = status === 0 ? '' : String(status);
            const isActive = statusFilter === filterValue;
            return (
              <button key={status} onClick={() => setStatusFilter(filterValue)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {status === 0 ? '全部' : orderStatusMap[status]?.label || '未知'}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">订单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">领养编号</th>
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
                  <td className="py-3 px-4 font-mono text-sm text-brand-primary">{order.adoption?.adoptionNo || '-'}</td>
                  <td className="py-3 px-4">{order.user?.phone || '-'}</td>
                  <td className="py-3 px-4">{order.livestock?.name || '-'}</td>
                  <td className="py-3 px-4">¥{order.totalAmount}</td>
                  <td className="py-3 px-4"><Badge variant={orderStatusMap[order.status]?.variant || 'default'}>{orderStatusMap[order.status]?.label || order.status}</Badge></td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetail(order.id)}>详情</Button>
                      {order.status === OrderStatus.PAID && (<Button size="sm" variant="danger" onClick={() => { setSelectedOrder(order); setShowRefund(true); }}>退款</Button>)}
                      {(order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) && (<Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => openDeleteConfirm(order)}>删除</Button>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState icon={<Icons.ShoppingCart className="w-12 h-12" />} title="暂无订单数据" />}
        </div>
      </Card>

      {showDetail && selectedOrder && (
        <Modal open={showDetail} onClose={() => setShowDetail(false)} title="订单详情">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-slate-500">订单号</p><p className="font-mono">{selectedOrder.orderNo}</p></div>
              <div><p className="text-sm text-slate-500">状态</p><Badge variant={orderStatusMap[selectedOrder.status]?.variant || 'default'}>{orderStatusMap[selectedOrder.status]?.label || selectedOrder.status}</Badge></div>
              <div><p className="text-sm text-slate-500">活体名称</p><p>{selectedOrder.livestock?.name || selectedOrder.livestockSnapshot?.name || '-'}</p></div>
              <div><p className="text-sm text-slate-500">领养编号</p><p className="font-mono text-brand-primary">{selectedOrder.adoption?.adoptionNo || '-'}</p></div>
              <div><p className="text-sm text-slate-500">用户手机</p><p>{selectedOrder.user?.phone || '-'}</p></div>
              <div><p className="text-sm text-slate-500">用户昵称</p><p>{selectedOrder.user?.nickname || '-'}</p></div>
              <div><p className="text-sm text-slate-500">订单金额</p><p className="text-lg font-bold text-brand-primary">¥{selectedOrder.totalAmount}</p></div>
              <div><p className="text-sm text-slate-500">支付方式</p><p>{getPaymentMethodText(selectedOrder.paymentMethod)}</p></div>
              <div><p className="text-sm text-slate-500">支付时间</p><p>{selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleString() : '-'}</p></div>
              <div className="col-span-2"><p className="text-sm text-slate-500">创建时间</p><p>{new Date(selectedOrder.createdAt).toLocaleString()}</p></div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDetail(false)}>关闭</Button>
              {selectedOrder.status === OrderStatus.PAID && (<Button onClick={() => { setShowDetail(false); setShowRefund(true); }}>申请退款</Button>)}
            </div>
          </div>
        </Modal>
      )}

      {showRefund && selectedOrder && (
        <Modal open={showRefund} onClose={() => { setShowRefund(false); setRefundReason(''); }} title="申请退款">
          <div className="space-y-4">
            <div><p className="text-sm text-slate-500 mb-2">订单信息</p><p className="font-mono">{selectedOrder.orderNo}</p><p className="text-lg font-bold text-brand-primary mt-1">¥{selectedOrder.totalAmount}</p></div>
            <div>
              <label className="block text-sm text-slate-500 mb-2" htmlFor="refund-reason">退款原因</label>
              <textarea id="refund-reason" className="w-full border border-slate-200 rounded-lg p-3 text-sm" rows={3} placeholder="请输入退款原因" value={refundReason} onChange={e => setRefundReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowRefund(false); setRefundReason(''); }}>取消</Button>
              <Button onClick={handleRefund} loading={processing}>确认退款</Button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteConfirm && selectedOrder && (
        <Modal open={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeleteConfirmStep(1); }} title="删除订单">
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-red-700 font-medium">{deleteConfirmStep === 1 ? '确定要删除此订单吗？' : '⚠️ 再次确认删除订单，此操作不可恢复！'}</p>
              <p className="text-sm text-red-600 mt-2">订单号: {selectedOrder.orderNo}</p>
              <p className="text-sm text-red-600">状态: {orderStatusMap[selectedOrder.status]?.label}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmStep(1); }}>取消</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>{deleteConfirmStep === 1 ? '确认删除' : '再次确认删除'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
