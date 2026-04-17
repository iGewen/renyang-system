import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Card, Button, Input, useToast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { balanceApi } from '../../services/api';
import type { BalanceLog } from '../../types';
import { usePaymentConfig } from '../../contexts/SiteConfigContext';

export const BalancePage: React.FC = () => {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [balance, setBalance] = useState(0);
  const [logs, setLogs] = useState<BalanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [recharging, setRecharging] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const paymentConfig = usePaymentConfig();

  const fetchData = async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const [balanceRes, logsRes] = await Promise.all([
        pageNum === 1 ? balanceApi.get() : Promise.resolve({ balance }),
        balanceApi.getLogs({ page: pageNum, pageSize: 10 })
      ]);
      if (pageNum === 1) {
        setBalance(Number(balanceRes?.balance) || 0);
      }
      const newLogs = logsRes?.list || [];
      if (append) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      setTotal(logsRes?.total || 0);
      setHasMore(newLogs.length === 10 && logs.length + newLogs.length < (logsRes?.total || 0));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData(1, false);
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchData(page + 1, true);
      setPage(prev => prev + 1);
    }
  };

  const filteredLogs = React.useMemo(() => {
    if (dateFilter === 'all') return logs;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return logs.filter(log => {
      const logDate = new Date(log.createdAt);
      if (dateFilter === 'today') {
        return logDate >= today;
      } else if (dateFilter === 'week') {
        return logDate >= weekAgo;
      } else if (dateFilter === 'month') {
        return logDate >= monthAgo;
      }
      return true;
    });
  }, [logs, dateFilter]);

  const getTypeText = (log: BalanceLog) => {
    const type = Number(log.type);
    const map: Record<number, string> = { 1: '充值', 2: '消费', 3: '退款', 4: '调整' };
    return map[type] || '未知';
  };

  const getTypeIcon = (log: BalanceLog) => {
    const type = Number(log.type);
    if (type === 1) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 7l-5-5-5 5" />
          <rect x="3" y="14" width="18" height="8" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      );
    }
    if (type === 2) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22V2M17 17l-5 5-5-5" />
          <rect x="3" y="2" width="18" height="8" rx="2" />
          <path d="M12 6h.01" />
        </svg>
      );
    }
    if (type === 3) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  };

  const getTypeColor = (log: BalanceLog) => {
    const type = Number(log.type);
    if (type === 1) return 'bg-emerald-100 text-emerald-600';
    if (type === 2) return 'bg-orange-100 text-orange-600';
    if (type === 3) return 'bg-blue-100 text-blue-600';
    return 'bg-slate-100 text-slate-600';
  };

  const getAmount = (log: BalanceLog) => {
    const amount = Number(log.amount) || 0;
    const type = Number(log.type);
    return type === 2 ? -Math.abs(amount) : Math.abs(amount);
  };

  const getBalanceAfter = (log: BalanceLog) => {
    return Number(log.balanceAfter) || 0;
  };

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    // 添加显式 NaN 检查
    if (isNaN(amount) || amount <= 0) {
      error('请输入正确的金额');
      return;
    }

    setRecharging(true);
    try {
      const result = await balanceApi.recharge(amount, paymentMethod);
      if (result.payUrl) {
        window.location.href = result.payUrl;
      } else {
        success('充值成功');
        setShowRecharge(false);
        fetchData(1, false);
      }
    } catch (err: any) {
      error(err.message || '充值失败');
    } finally {
      setRecharging(false);
    }
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
          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowRecharge(true)}
            icon={<Icons.Plus className="w-5 h-5" />}
          >
            充值余额
          </Button>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">交易记录</h2>
              <span className="text-sm text-slate-400">共 {total} 条</span>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {[
                { key: 'all', label: '全部' },
                { key: 'today', label: '今天' },
                { key: 'week', label: '近7天' },
                { key: 'month', label: '近30天' }
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setDateFilter(item.key as any)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    dateFilter === item.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={<Icons.History className="w-16 h-16" />}
                title="暂无交易记录"
              />
            ) : (
              <div className="space-y-3">
                {filteredLogs.map(log => {
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

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      loading={loadingMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? '加载中...' : '加载更多'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
                  {paymentConfig.alipayEnabled && (
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
                  )}
                  {paymentConfig.wechatEnabled && (
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
                  )}
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

export default BalancePage;
