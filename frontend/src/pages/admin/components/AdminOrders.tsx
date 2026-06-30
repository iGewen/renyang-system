import React, { useState, useEffect, useCallback } from 'react';
import { Icons, LoadingSpinner, Button, Badge, Card, Modal, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { AdoptionOrder } from '../../../types';
import { OrderStatus } from '../../../types/enums';
import type { StatusVariant } from './admin-utils';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const toast = useToast();
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [text, toast]);
  return (
    <button type="button" onClick={handleCopy} className="flex-shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="复制">
      <Icons.Copy className="w-3.5 h-3.5" />
    </button>
  );
};

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
        <Modal open={showDetail} onClose={() => setShowDetail(false)} size="lg">
          <div className="w-[460px]">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-lg font-bold text-slate-900">订单详情</h3>
              <button type="button" onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-6 h-px bg-slate-200" />

            {/* 金额区 */}
            <div className="mx-6 mt-6 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 text-center">
              <Badge variant="success" className="mb-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {orderStatusMap[selectedOrder.status]?.label || selectedOrder.status}
                </span>
              </Badge>
              <div className="text-[32px] font-bold text-slate-900 leading-none">¥{selectedOrder.totalAmount}</div>
              <div className="mt-2 text-sm text-slate-400">{getPaymentMethodText(selectedOrder.paymentMethod)}</div>
            </div>

            {/* 信息区 */}
            <div className="px-6 pt-6 pb-4 space-y-6">

              {/* 商品信息 */}
              <div>
                <div className="text-xs text-slate-400 tracking-wider mb-3">商品信息</div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">活体名称</span>
                    <span className="text-sm text-slate-900">{selectedOrder.livestock?.name || selectedOrder.livestockSnapshot?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">领养编号</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded text-xs font-mono text-slate-700">
                      {selectedOrder.adoption?.adoptionNo || '-'}
                      {selectedOrder.adoption?.adoptionNo && <CopyButton text={selectedOrder.adoption.adoptionNo} />}
                    </span>
                  </div>
                </div>
              </div>

              {/* 虚线分割 */}
              <div className="border-t border-dashed border-slate-200" />

              {/* 用户信息 */}
              <div>
                <div className="text-xs text-slate-400 tracking-wider mb-3">用户信息</div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">用户昵称</span>
                    <span className="text-sm text-slate-900">{selectedOrder.user?.nickname || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">手机号码</span>
                    <span className="text-sm text-slate-900">{selectedOrder.user?.phone || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 虚线分割 */}
              <div className="border-t border-dashed border-slate-200" />

              {/* 交易信息 */}
              <div>
                <div className="text-xs text-slate-400 tracking-wider mb-3">交易信息</div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">创建时间</span>
                    <span className="text-sm text-slate-900">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">支付时间</span>
                    <span className="text-sm text-slate-900">{selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleString() : '-'}</span>
                  </div>
                </div>
              </div>

              {/* 虚线分割 - 仅已支付订单显示单号区 */}
              {selectedOrder.paymentNo && (
                <>
                  <div className="border-t border-dashed border-slate-200" />

                  {/* 单号信息 */}
                  <div>
                    <div className="text-xs text-slate-400 tracking-wider mb-3">单号信息</div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">商户单号</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded text-xs font-mono text-slate-700 max-w-[220px] truncate">
                          {selectedOrder.payPaymentNo || selectedOrder.paymentNo}
                          <CopyButton text={selectedOrder.payPaymentNo || selectedOrder.paymentNo || ''} />
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">微信交易号</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded text-xs font-mono text-slate-700 max-w-[220px] truncate">
                          {selectedOrder.transactionId || '-'}
                          {selectedOrder.transactionId && <CopyButton text={selectedOrder.transactionId} />}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 底部操作区 */}
            <div className="px-6 pb-6 pt-2 flex gap-3">
              <Button variant="outline" onClick={() => setShowDetail(false)} className="flex-1">关闭</Button>
              {selectedOrder.status === OrderStatus.PAID && (
                <Button onClick={() => { setShowDetail(false); setShowRefund(true); }} className="flex-1" variant="primary">申请退款</Button>
              )}
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
