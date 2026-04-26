import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons, PageTransition, Button } from '../../components/ui';
import { usePaymentConfig } from '../../contexts/SiteConfigContext';
import { useToast } from '../../components/ui';
import { orderApi, paymentApi } from '../../services/api';
import { OrderStatus } from '../../types/enums';

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { error, success } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const [orderExpired, setOrderExpired] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const paymentConfig = usePaymentConfig();

  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        console.error('PaymentPage: 没有 orderId 参数');
        error('订单数据不存在，请重新下单');
        navigate('/');
        return;
      }

      try {
        const order = await orderApi.getById(orderId);
        if (order.status === OrderStatus.PENDING_PAYMENT) {
          setOrderData({
            orderId: order.id,
            orderNo: order.orderNo,
            livestock: order.livestock,
          });
        } else {
          setOrderExpired(true);
          error('订单已过期或已支付，请返回订单列表查看');
        }
      } catch (err: any) {
        console.error('检查订单状态失败:', err);
        error('获取订单信息失败');
        navigate('/orders');
      } finally {
        setCheckingOrder(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate, error]);

  const handlePay = async (method: 'alipay' | 'wechat' | 'balance') => {
    if (!orderData?.orderId) {
      error('订单数据不存在，请重新下单');
      navigate('/');
      return;
    }

    if (orderExpired) {
      error('订单已过期，无法支付');
      navigate('/orders');
      return;
    }

    setIsPaying(true);
    try {
      const order = await orderApi.getById(orderData.orderId);
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        error('订单状态已变更，请返回订单列表查看');
        navigate('/orders');
        return;
      }

      const amount = orderData?.livestock?.price || 0;
      const result = await paymentApi.create({ orderType: 'adoption', orderId: orderData.orderId, paymentMethod: method, amount });

      if (result.payUrl) {
        globalThis.location.href = result.payUrl;
      } else {
        success('支付成功');
        navigate(`/success?orderId=${orderData.orderId}`, { replace: true });
      }
    } catch (err: any) {
      console.error('支付失败:', err);
      error(err.message || '支付失败，请重试');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">收银台</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="max-w-md mx-auto flex flex-col items-center py-16 px-8">
          {checkingOrder && (
            <div className="flex flex-col items-center py-16">
              <Icons.Loader2 className="w-8 h-8 text-brand-primary animate-spin mb-4" />
              <p className="text-slate-400">正在检查订单状态...</p>
            </div>
          )}

          {!checkingOrder && orderExpired && (
            <div className="flex flex-col items-center py-16">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <Icons.AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">订单已过期</h2>
              <p className="text-slate-400 mb-6">该订单已超时取消，请重新下单</p>
              <Button onClick={() => navigate('/orders')}>查看订单列表</Button>
            </div>
          )}

          {!checkingOrder && !orderExpired && (
            <>
              <div className="w-20 h-20 bg-brand-bg rounded-[24px] flex items-center justify-center mb-6 shadow-sm">
                <Icons.CreditCard className="w-10 h-10 text-brand-primary" />
              </div>
              <p className="text-slate-400 text-sm font-medium mb-2">支付金额</p>
              <div className="flex items-baseline gap-1 mb-16">
                <span className="text-xl font-bold text-slate-900">¥</span>
                <h2 className="text-5xl font-display font-bold text-slate-900">{orderData?.livestock?.price || '0.00'}</h2>
              </div>

              <div className="w-full premium-card p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">收款方</span>
                  <span className="text-sm font-bold text-brand-primary">云端牧场智慧平台</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">订单号</span>
                  <span className="text-sm font-mono text-slate-600">{orderData?.orderNo}</span>
                </div>
              </div>

              <div className="w-full mt-8 space-y-3">
                {paymentConfig.loaded ? (
                  <>
                    {paymentConfig.alipayEnabled && (
                      <button onClick={() => handlePay('alipay')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-blue-500 text-blue-600 rounded-2xl font-medium hover:bg-blue-50 transition-colors disabled:opacity-50">
                        <Icons.Alipay className="w-6 h-6" />支付宝支付
                      </button>
                    )}
                    {paymentConfig.wechatEnabled && (
                      <button onClick={() => handlePay('wechat')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-green-500 text-green-600 rounded-2xl font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                        <Icons.Wechat className="w-6 h-6" />微信支付
                      </button>
                    )}
                    <button onClick={() => handlePay('balance')} disabled={isPaying} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-brand-primary text-brand-primary rounded-2xl font-medium hover:bg-brand-primary/5 transition-colors disabled:opacity-50">
                      <Icons.Wallet className="w-6 h-6" />余额支付
                    </button>
                  </>
                ) : (
                  <div className="flex justify-center py-8">
                    <Icons.Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                  </div>
                )}
              </div>

              <p className="mt-8 text-[10px] text-slate-300 flex items-center gap-2">
                <Icons.ShieldCheck className="w-3 h-3" /> 支付安全加密保障
              </p>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default PaymentPage;
