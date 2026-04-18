import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Card, Modal } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adoptionApi } from '../../services/api';
import { FeedBillStatus } from '../../types/enums';
import type { FeedBill } from '../../types';
import { usePaymentConfig } from '../../contexts/SiteConfigContext';

const FeedBillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<FeedBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat' | 'balance' | null>(null);
  const paymentConfig = usePaymentConfig();

  useEffect(() => {
    const fetchBill = async () => {
      if (!id) return;
      try {
        const data = await adoptionApi.getFeedBillById(id);
        setBill(data);
      } catch (error) {
        console.error('Failed to fetch feed bill:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [id]);

  const handlePay = async () => {
    if (!id) return;
    if (!paymentMethod) {
      alert('请选择支付方式');
      return;
    }
    setPaying(true);
    try {
      const result = await adoptionApi.payFeedBill(id, paymentMethod);
      if (result.payUrl) {
        window.location.href = result.payUrl;
      } else {
        alert('支付成功');
        navigate(-1);
      }
    } catch (error: any) {
      alert(error.message || '支付失败');
    } finally {
      setPaying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getStatusConfig = (status: number) => {
    const map: Record<number, { label: string; color: string }> = {
      [FeedBillStatus.PENDING]: { label: '待支付', color: 'text-orange-600 bg-orange-50' },
      [FeedBillStatus.PAID]: { label: '已支付', color: 'text-green-600 bg-green-50' },
      [FeedBillStatus.OVERDUE]: { label: '已逾期', color: 'text-red-600 bg-red-50' },
      [FeedBillStatus.WAIVED]: { label: '已免除', color: 'text-slate-600 bg-slate-100' },
    };
    return map[status] || { label: '未知', color: 'text-slate-600 bg-slate-100' };
  };

  if (loading) return <LoadingSpinner />;
  if (!bill) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex items-center justify-center">
          <p className="text-slate-400">账单不存在</p>
        </div>
      </PageTransition>
    );
  }

  const totalAmount = (Number(bill.adjustedAmount) || Number(bill.originalAmount) || 0) + (Number(bill.lateFeeAmount) || 0);
  const statusConfig = getStatusConfig(bill.status);

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">饲料费账单</h1>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="px-6 mt-6 space-y-4">
          {/* Status Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{bill.billMonth} 月饲料费</h3>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm">应付金额</p>
              <p className="text-4xl font-display font-bold text-brand-primary mt-2">
                ¥{totalAmount.toFixed(2)}
              </p>
            </div>
          </Card>

          {/* Bill Details */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">账单详情</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">账单编号</span>
                <span className="font-mono text-slate-900">{bill.billNo}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">账单日期</span>
                <span className="text-slate-900">{formatDate(bill.billDate)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">原金额</span>
                <span className="text-slate-900">¥{Number(bill.originalAmount || 0).toFixed(2)}</span>
              </div>
              {bill.adjustedAmount !== null && bill.adjustedAmount !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-slate-500">调整金额</span>
                  <span className="text-brand-primary">¥{Number(bill.adjustedAmount).toFixed(2)}</span>
                </div>
              )}
              {Number(bill.lateFeeAmount || 0) > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-slate-500">滞纳金</span>
                  <span className="text-red-500">¥{Number(bill.lateFeeAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">逾期天数</span>
                <span className={bill.lateFeeDays > 0 ? 'text-red-500' : 'text-slate-900'}>
                  {bill.lateFeeDays} 天
                </span>
              </div>
              {bill.paidAt && (
                <div className="flex justify-between items-center py-3">
                  <span className="text-slate-500">支付时间</span>
                  <span className="text-slate-900">{formatDate(bill.paidAt)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Payment Button */}
          {bill.status === FeedBillStatus.PENDING && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => setShowPaymentModal(true)}
              icon={<Icons.CreditCard className="w-5 h-5" />}
            >
              立即支付
            </Button>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPaymentModal(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">选择支付方式</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400">
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>
              <div className="text-center mb-6">
                <p className="text-slate-500 text-sm">支付金额</p>
                <p className="text-3xl font-display font-bold text-brand-primary">¥{totalAmount.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                {[
                  ...(paymentConfig.alipayEnabled ? [{ key: 'alipay', icon: Icons.Alipay, label: '支付宝', color: 'text-blue-500' }] : []),
                  ...(paymentConfig.wechatEnabled ? [{ key: 'wechat', icon: Icons.Wechat, label: '微信支付', color: 'text-green-500' }] : []),
                  { key: 'balance', icon: Icons.Wallet, label: '余额支付', color: 'text-brand-primary' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setPaymentMethod(item.key as any)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors',
                      paymentMethod === item.key ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100'
                    )}
                  >
                    <item.icon className={cn('w-6 h-6', item.color)} />
                    <span className="font-medium">{item.label}</span>
                    {paymentMethod === item.key && <Icons.Check className="w-5 h-5 text-brand-primary ml-auto" />}
                  </button>
                ))}
              </div>
              <Button
                className="w-full mt-6"
                size="lg"
                onClick={handlePay}
                loading={paying}
                disabled={!paymentMethod}
              >
                {paymentMethod ? '确认支付' : '请选择支付方式'}
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default FeedBillDetailPage;
