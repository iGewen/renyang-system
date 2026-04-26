/**
 * PaymentResultPage.tsx - 支付结果页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Button, useToast } from '../../components/ui';
import { paymentApi } from '../../services/api';

const PaymentResultPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'pending' | 'failed' | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  // 使用 ref 保存轮询定时器引用，确保组件卸载时能正确清理
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从URL参数获取支付信息
  const searchParams = new URLSearchParams(location.search);
  const outTradeNo = searchParams.get('out_trade_no');
  const paymentNo = searchParams.get('payment_no');

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!outTradeNo && !paymentNo) {
        // 没有支付参数，跳转到订单列表
        navigate('/orders');
        return;
      }

      try {
        // 查询支付状态
        const paymentIdentifier = paymentNo || outTradeNo;
        if (!paymentIdentifier) {
          throw new Error('缺少支付参数');
        }

        const result = await paymentApi.getStatus(paymentIdentifier);

        if (result.status === 2) {
          // 支付成功
          setPaymentStatus('success');
          setOrderInfo(result);
          success('支付成功！');
        } else if (result.status === 1) {
          // 待支付，轮询查询
          setPaymentStatus('pending');
          let retryCount = 0;
          const maxRetries = 10;

          pollIntervalRef.current = setInterval(async () => {
            retryCount++;
            try {
              const pollResult = await paymentApi.getStatus(paymentIdentifier);
              if (pollResult.status === 2) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setPaymentStatus('success');
                setOrderInfo(pollResult);
                success('支付成功！');
              } else if (pollResult.status === 3 || retryCount >= maxRetries) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                if (pollResult.status === 3) {
                  setPaymentStatus('failed');
                } else {
                  setPaymentStatus('pending');
                  error('支付状态查询超时，请稍后在订单列表查看');
                }
              }
            } catch (e) {
              // 轮询失败时静默处理，不影响用户流程
              console.debug('支付状态轮询:', e);
            }
          }, 2000);
        } else {
          // 支付失败或已关闭
          setPaymentStatus('failed');
        }
      } catch (err: any) {
        setPaymentStatus('failed');
        error(err.message || '查询支付状态失败');
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [outTradeNo, paymentNo, navigate, success, error]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <Icons.Loader2 className="w-12 h-12 text-brand-primary animate-spin mb-4" />
          <p className="text-slate-500">正在查询支付结果...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
        {paymentStatus === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付成功</h2>
            <p className="text-slate-500 mb-6">您的订单已支付完成</p>
            {orderInfo && (
              <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">支付金额</span>
                  <span className="font-bold text-brand-primary">¥{orderInfo.amount}</span>
                </div>
                {orderInfo.paymentNo && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500">支付单号</span>
                    <span className="font-mono text-sm text-slate-600">{orderInfo.paymentNo}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/my-adoptions')}>
                进入牧场
              </Button>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'pending' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.Clock className="w-12 h-12 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付处理中</h2>
            <p className="text-slate-500 mb-6">请稍后在订单列表查看支付状态</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'failed' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">支付失败</h2>
            <p className="text-slate-500 mb-6">支付遇到问题，请重新尝试</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/orders')}>
                查看订单
              </Button>
              <Button onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default PaymentResultPage;