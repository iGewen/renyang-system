/**
 * SuccessPage.tsx - 领养成功页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, LoadingSpinner } from '../../components/ui';
import { cn } from '../../lib/utils';
import { orderApi } from '../../services/api';

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 从 URL 参数获取 orderId
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('orderId');

  // 从后端获取订单数据
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        // 没有 orderId，跳转到订单列表
        navigate('/orders');
        return;
      }

      try {
        const order = await orderApi.getById(orderId);
        setOrderData({
          orderId: order.id,
          orderNo: order.orderNo,
          livestock: order.livestock,
        });
      } catch (error) {
        console.error('Failed to fetch order data:', error);
        // 获取失败，跳转到订单列表
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 2500),
      setTimeout(() => setStep(3), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
        <div className="max-w-screen-xl mx-auto w-full flex flex-col items-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-12">
            <div className="w-24 h-24 bg-brand-primary rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-primary/30">
              <Icons.CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-display font-bold text-brand-primary mb-3">领养成功</h2>
            <p className="text-slate-400 text-sm">您的智慧牧场生活正式开启</p>
          </motion.div>
          <div className="w-full max-w-2xl bg-white rounded-2xl p-8 mb-10 shadow-sm">
            <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-50">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">领养编号</p>
                <p className="text-lg font-mono font-bold text-brand-primary">{orderData?.orderId || 'ADPT-' + Date.now().toString(36).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">订单状态</p>
                <p className="text-sm font-bold text-green-600">已完成</p>
              </div>
            </div>
            <div className="space-y-8 relative">
              <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-slate-100" />
              {[
                { title: '订单已转入消息队列', desc: '正在同步牧场管理系统...', icon: Icons.Zap },
                { title: '领养详情短信已发送', desc: '请查收您的手机通知', icon: Icons.MessageSquare },
                { title: '领养流程已全部完成', desc: '您可以前往牧场查看', icon: Icons.ShieldCheck }
              ].map((s, i) => (
                <div key={`step-${s.title.slice(0, 4)}-${i}`} className="flex gap-6 relative">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center z-10 transition-colors duration-500", step >= i + 1 ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-slate-100 text-slate-300")}>
                    <s.icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-bold transition-colors duration-500", step >= i + 1 ? "text-slate-900" : "text-slate-300")}>{s.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => navigate('/my-adoptions')} className="w-full max-w-2xl bg-brand-primary text-white font-bold py-4 rounded-2xl hover:bg-brand-primary/90 transition-colors">进入我的牧场</button>
        </div>
      </div>
    </PageTransition>
  );
};

export default SuccessPage;