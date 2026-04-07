import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Card, Button, Input, EmptyState, Badge, useToast } from '../components/ui';
import { balanceApi } from '../services/api';
import type { BalanceLog } from '../types';

export const BalancePage: React.FC = () => {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [balance, setBalance] = useState(0);
  const [logs, setLogs] = useState<BalanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, logsRes] = await Promise.all([
        balanceApi.get(),
        balanceApi.getLogs()
      ]);
      setBalance(balanceRes?.balance || 0);
      setLogs(logsRes?.list || []);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      error('请输入正确的金额');
      return;
    }

    setRecharging(true);
    try {
      const result = await balanceApi.recharge(amount, paymentMethod);
      if (result.payUrl) {
        // 跳转到支付页面
        window.location.href = result.payUrl;
      } else {
        success('充值成功');
        setShowRecharge(false);
        fetchData();
      }
    } catch (err: any) {
      error(err.message || '充值失败');
    } finally {
      setRecharging(false);
    }
  };

  const getTypeText = (log: BalanceLog) => {
    const type = Number(log.type);
    const map: Record<number, string> = {
      1: '充值',
      2: '消费',
      3: '退款',
      4: '调整'
    };
    return map[type] || '未知';
  };

  const getTypeBadge = (log: BalanceLog) => {
    const type = Number(log.type);
    const map: Record<number, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      1: 'success',  // 充值
      2: 'warning',  // 消费
      3: 'info',     // 退款
      4: 'default'   // 调整
    };
    return map[type] || 'default';
  };

  const getTypeIcon = (log: BalanceLog) => {
    const type = Number(log.type);
    if (type === 1) return <Icons.Plus className="w-5 h-5" />;
    if (type === 2) return <Icons.Minus className="w-5 h-5" />;
    if (type === 3) return <Icons.RotateCw className="w-5 h-5" />;
    return <Icons.Edit className="w-5 h-5" />;
  };

  const getTypeColor = (log: BalanceLog) => {
    const type = Number(log.type);
    if (type === 1) return 'bg-green-100 text-green-600';  // 充值
    if (type === 2) return 'bg-orange-100 text-orange-600'; // 消费
    if (type === 3) return 'bg-blue-100 text-blue-600';    // 退款
    return 'bg-slate-100 text-slate-600';                  // 调整
  };

  // type=1是充值（正数），type=2是消费（存为正数，显示为负）
  const getAmount = (log: BalanceLog) => {
    const amount = Number(log.amount) || 0;
    const type = Number(log.type);
    return type === 2 ? -Math.abs(amount) : Math.abs(amount);
  };

  const getBalanceAfter = (log: BalanceLog) => {
    return Number(log.balanceAfter) || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Icons.Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="bg-brand-primary text-white px-6 pt-6 pb-12 rounded-b-[32px]">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">我的余额</h1>
            <div className="w-10" />
          </div>

          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">账户余额（元）</p>
            <p className="text-5xl font-display font-bold">{balance.toFixed(2)}</p>
          </div>
        </div>

        <div className="px-6 -mt-6">
          {/* 充值按钮 */}
          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowRecharge(true)}
            icon={<Icons.Plus className="w-5 h-5" />}
          >
            充值余额
          </Button>

          {/* 流水记录 */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">交易记录</h2>
            {logs.length === 0 ? (
              <EmptyState
                icon={<Icons.History className="w-16 h-16" />}
                title="暂无交易记录"
              />
            ) : (
              <div className="space-y-3">
                {logs.map(log => {
                  const amount = getAmount(log);
                  return (
                    <Card key={log.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(log)}`}>
                            {getTypeIcon(log)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{log.remark || getTypeText(log)}</p>
                            <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${amount > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                            {amount > 0 ? '+' : ''}{amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-400">余额: {getBalanceAfter(log).toFixed(2)}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 充值弹窗 */}
        {showRecharge && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowRecharge(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">充值余额</h3>
                <button onClick={() => setShowRecharge(false)} className="text-slate-400">
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>

              <Input
                label="充值金额"
                type="number"
                placeholder="请输入充值金额"
                value={rechargeAmount}
                onChange={e => setRechargeAmount(e.target.value)}
                icon={<Icons.Coins className="w-5 h-5" />}
              />

              <div className="flex gap-3 mt-4">
                {[50, 100, 200, 500].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setRechargeAmount(amount.toString())}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      rechargeAmount === amount.toString()
                        ? 'bg-brand-primary text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ¥{amount}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <p className="text-sm text-slate-500 mb-3">支付方式</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setPaymentMethod('alipay')}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                      paymentMethod === 'alipay' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100'
                    }`}
                  >
                    <Icons.Alipay className="w-6 h-6 text-blue-500" />
                    <span className="font-medium">支付宝</span>
                    {paymentMethod === 'alipay' && <Icons.Check className="w-5 h-5 text-brand-primary ml-auto" />}
                  </button>
                  <button
                    onClick={() => setPaymentMethod('wechat')}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                      paymentMethod === 'wechat' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100'
                    }`}
                  >
                    <Icons.Wechat className="w-6 h-6 text-green-500" />
                    <span className="font-medium">微信支付</span>
                    {paymentMethod === 'wechat' && <Icons.Check className="w-5 h-5 text-brand-primary ml-auto" />}
                  </button>
                </div>
              </div>

              <Button className="w-full mt-6" size="lg" onClick={handleRecharge} loading={recharging}>
                确认充值
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
