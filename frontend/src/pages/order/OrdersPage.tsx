import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, EmptyState, Modal, Input, useToast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { orderApi, refundApi } from '../../services/api';
import type { Order } from '../../types';
import { OrderStatus, getOrderStatusText } from '../../types/enums';

type OrderFilterTab = 'all' | 'pending_payment' | 'paid' | 'cancelled' | 'refunded';

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status') as OrderFilterTab;
    if (statusParam) setActiveTab(statusParam);
  }, [location.search]);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        // 状态过滤：前端使用字符串，API需要数字
        let statusNumber: OrderStatus | undefined;
        if (activeTab === 'pending_payment') {
          statusNumber = OrderStatus.PENDING_PAYMENT;
        } else if (activeTab === 'paid') {
          statusNumber = OrderStatus.PAID;
        } else if (activeTab === 'cancelled') {
          statusNumber = OrderStatus.CANCELLED;
        } else if (activeTab === 'refunded') {
          statusNumber = OrderStatus.REFUNDED;
        }
        // activeTab === 'all' 时 statusNumber 为 undefined

        const data = await orderApi.getMyOrders({
          status: statusNumber
        });
        setOrders(data.list);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [activeTab]);

  const getStatusConfig = (status: number) => {
    const map: Record<number, { label: string; variant: 'warning' | 'success' | 'default' | 'danger'; color: string }> = {
      [OrderStatus.PENDING_PAYMENT]: { label: '待付款', variant: 'warning', color: 'text-orange-600 bg-orange-50' },
      [OrderStatus.PAID]: { label: '已支付', variant: 'success', color: 'text-green-600 bg-green-50' },
      [OrderStatus.CANCELLED]: { label: '已取消', variant: 'default', color: 'text-slate-500 bg-slate-100' },
      [OrderStatus.REFUNDED]: { label: '已退款', variant: 'danger', color: 'text-red-600 bg-red-50' }
    };
    return map[status] || { label: getOrderStatusText(status), variant: 'default', color: 'text-slate-500 bg-slate-100' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApplyRefund = async () => {
    if (!refundOrder) return;
    if (!refundReason.trim()) {
      toastError('请填写退款原因');
      return;
    }
    setRefundLoading(true);
    try {
      await refundApi.apply({
        orderType: 'adoption',
        orderId: refundOrder.id,
        reason: refundReason.trim()
      });
      success('退款申请已提交，请等待审核');
      setShowRefundModal(false);
      setRefundOrder(null);
      setRefundReason('');
      // 刷新订单列表
      const data = await orderApi.getMyOrders({});
      setOrders(data.list);
    } catch (error: any) {
      toastError(error.message || '申请退款失败');
    } finally {
      setRefundLoading(false);
    }
  };

  const tabs: { key: OrderFilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending_payment', label: '待付款' },
    { key: 'paid', label: '已支付' },
    { key: 'cancelled', label: '已取消' }
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">我的订单</h1>
            <div className="w-10" />
          </div>
          <div className="flex gap-2 px-6 pb-4 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === tab.key
                    ? 'bg-brand-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 mt-4">
          {loading ? (
            <LoadingSpinner />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Icons.ShoppingCart className="w-16 h-16" />}
              title="暂无订单"
              description={activeTab === 'all' ? '您还没有任何订单' : '该分类下暂无订单'}
              action={
                <Button onClick={() => navigate('/')} size="sm">
                  去领养
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {orders.map(order => {
                const statusConfig = getStatusConfig(order.status);
                return (
                  <Card key={order.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-400 font-mono">{order.orderNo}</span>
                      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        {order.livestockSnapshot?.mainImage && (
                          <img
                            src={order.livestockSnapshot.mainImage}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">
                          {order.livestockSnapshot?.name || '未知商品'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">数量: {order.quantity}</p>
                        <p className="text-sm text-slate-400 mt-1">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand-primary">¥{order.totalAmount}</p>
                      </div>
                    </div>
                    {order.status === OrderStatus.PENDING_PAYMENT && (
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={async () => {
                            if (confirm('确定要取消订单吗？')) {
                              await orderApi.cancel(order.id);
                              setOrders(prev => prev.filter(o => o.id !== order.id));
                            }
                          }}
                        >
                          取消订单
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate('/payment', { state: { orderId: order.id, orderNo: order.orderNo, livestock: order.livestockSnapshot } })}
                        >
                          立即支付
                        </Button>
                      </div>
                    )}
                    {order.status === OrderStatus.PAID && (
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            // 领养详情页现在支持通过领养ID或订单ID访问
                            const targetId = order.adoption?.id || order.id;
                            navigate(`/adoption/${targetId}`);
                          }}
                        >
                          查看详情
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-red-500 hover:bg-red-600"
                          onClick={() => {
                            setRefundOrder(order);
                            setRefundReason('');
                            setShowRefundModal(true);
                          }}
                        >
                          申请退款
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 退款申请弹窗 */}
        <Modal open={showRefundModal} onClose={() => setShowRefundModal(false)} title="申请退款">
          <div className="space-y-4">
            {refundOrder && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">订单编号</p>
                <p className="font-mono text-slate-900">{refundOrder.orderNo}</p>
                <p className="text-sm text-slate-500 mt-2">商品名称</p>
                <p className="text-slate-900">{refundOrder.livestockSnapshot?.name}</p>
                <p className="text-sm text-slate-500 mt-2">退款金额</p>
                <p className="text-lg font-bold text-brand-primary">¥{refundOrder.totalAmount}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">退款原因 *</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
                rows={3}
                placeholder="请说明退款原因"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400">
              退款申请提交后，管理员将在1-3个工作日内审核。审核通过后，退款将原路返回。
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRefundModal(false)}>
                取消
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                onClick={handleApplyRefund}
                disabled={refundLoading}
              >
                {refundLoading ? '提交中...' : '提交申请'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

export default OrdersPage;
