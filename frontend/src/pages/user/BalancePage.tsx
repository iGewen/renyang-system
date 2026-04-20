import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Card, Button, Input, useToast, EmptyState } from '../../components/ui';
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

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
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
      setHasMore(newLogs.length === 10);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

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
    // 收入（充值/退款）- 红色向下箭头
    if (type === 1 || type === 3) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 1024 1024">
          <path d="M633.2416 284.672l-98.9696 131.9424h66.9184a17.664 17.664 0 1 1 0 35.328h-71.168v36.1472h71.168a17.7152 17.7152 0 1 1 0 35.328h-71.168v53.76h-0.256l0.1024 0.5632a17.8176 17.8176 0 0 1-17.8688 17.92 17.8176 17.8176 0 0 1-17.8688-17.92l0.1024-0.512h-0.3584v-53.76H422.8096a17.664 17.664 0 1 1 0-35.328h71.0656V452.096H422.8096a17.664 17.664 0 1 1 0-35.328h66.9184L390.7584 284.672a17.8176 17.8176 0 1 1 28.5184-21.504L512 386.8672l92.5184-123.6992a18.2272 18.2272 0 0 1 25.1904-3.5328 17.92 17.92 0 0 1 3.584 25.088m235.2128 250.0096a28.672 28.672 0 0 0-26.9312-18.3296h-154.5728V177.0496A23.2448 23.2448 0 0 0 663.296 153.6H361.2672a23.9616 23.9616 0 0 0-24.4736 23.4496v339.3536H182.4768a28.8256 28.8256 0 0 0-27.0336 18.432 28.8768 28.8768 0 0 0 7.7824 31.744l331.4176 296.4992a28.7744 28.7744 0 0 0 38.5536-0.1536l327.68-296.448a28.8768 28.8768 0 0 0 7.5776-31.744" fill="currentColor" />
        </svg>
      );
    }
    // 支出（消费）- 蓝色向上箭头
    if (type === 2) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 1024 1024">
          <path d="M513.8944 153.6c6.912 0 13.824 2.5088 19.3024 7.4752l327.68 296.448a28.672 28.672 0 1 1-19.3024 50.0736h-154.624v339.3536a23.2448 23.2448 0 0 1-23.552 23.4496H361.216a23.9104 23.9104 0 0 1-24.4736-23.4496V507.5968H182.4768a28.8768 28.8768 0 0 1-26.9824-18.432 28.8768 28.8768 0 0 1 7.7312-31.744l331.4688-296.4992A28.8256 28.8256 0 0 1 513.8944 153.6z m-96.256 250.2656a17.8688 17.8688 0 1 0-28.5184 21.504l98.9696 132.096H421.1712a17.664 17.664 0 1 0 0 35.328h71.1168v36.096H421.1712a17.664 17.664 0 1 0 0 35.328h71.1168v53.76c0.3072 0 0.2048 0.3072 0.2048 0.512a17.8688 17.8688 0 1 0 35.7376 0l-0.0512-0.6144h0.1536v-53.76h71.2192a17.664 17.664 0 1 0 0-35.328H528.384v-36.096h71.2192a17.664 17.664 0 1 0 0-35.328h-66.9184l98.9696-131.9936a17.92 17.92 0 0 0-3.584-25.0368 18.176 18.176 0 0 0-25.1904 3.584l-92.5184 123.648z" fill="currentColor" />
        </svg>
      );
    }
    // 调整 - 设置图标
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  };

  const getTypeColor = (log: BalanceLog) => {
    const type = Number(log.type);
    if (type === 1) return 'bg-red-100 text-red-500';  // 充值 - 红色
    if (type === 2) return 'bg-blue-100 text-blue-500';  // 消费 - 蓝色
    if (type === 3) return 'bg-red-100 text-red-500';  // 退款 - 红色
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
    const amount = Number.parseFloat(rechargeAmount);
    // 添加显式 NaN 检查
    if (isNaN(amount) || amount <= 0) {
      error('请输入正确的金额');
      return;
    }

    setRecharging(true);
    try {
      const result = await balanceApi.recharge(amount, paymentMethod);
      if (result.payUrl) {
        globalThis.location.href = result.payUrl;
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
                    <Card key={log.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(log)}`}>
                            {getTypeIcon(log)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-900 truncate">{log.remark || getTypeText(log)}</p>
                            <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${amount > 0 ? 'text-green-600' : 'text-slate-900'}`}>
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
