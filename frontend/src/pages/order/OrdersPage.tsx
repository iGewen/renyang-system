import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils';
import { orderApi } from '../../services/api';
import type { Order } from '../../types';
import { OrderStatus, getOrderStatusText } from '../../types/enums';

type OrderFilterTab = 'all' | 'pending_payment' | 'paid' | 'cancelled' | 'refunded';

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');

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
        const statusNumber = activeTab === 'all' ? undefined :
          activeTab === 'pending_payment' ? OrderStatus.PENDING_PAYMENT :
          activeTab === 'paid' ? OrderStatus.PAID :
          activeTab === 'cancelled' ? OrderStatus.CANCELLED :
          activeTab === 'refunded' ? OrderStatus.REFUNDED : undefined;

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

  const tabs: { key: OrderStatus; label: string }[] = [
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
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default OrdersPage;
