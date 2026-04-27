/**
 * WalletPage.tsx - 我的钱包页面
 * 整合所有交易记录（余额/支付宝/微信支付）
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, Icons, Card, Button, Input, useToast, EmptyState, LoadingSpinner } from '../../components/ui';
import { cn } from '../../lib/utils';
import { walletApi, type TransactionRecord } from '../../services/wallet.api';
import { usePaymentConfig } from '../../contexts/SiteConfigContext';

type TransactionType = 'all' | 'payment' | 'refund' | 'recharge';
type PaymentMethod = 'all' | 'balance' | 'alipay' | 'wechat';
type DateRange = 'all' | 'today' | 'week' | 'month';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // 充值相关
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [recharging, setRecharging] = useState(false);

  // 筛选相关
  const [showFilter, setShowFilter] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransactionType>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>('all');
  const [dateFilter, setDateFilter] = useState<DateRange>('all');

  const paymentConfig = usePaymentConfig();

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      // 计算时间筛选参数
      let startDate: string | undefined;
      let endDate: string | undefined;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter === 'today') {
        startDate = today.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      }

      const [overviewRes, transactionsRes] = await Promise.all([
        pageNum === 1 ? walletApi.getOverview() : Promise.resolve({ balance }),
        walletApi.getTransactions({
          page: pageNum,
          pageSize: 20,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
          startDate,
          endDate,
        }),
      ]);

      if (pageNum === 1) {
        setBalance(Number(overviewRes?.balance) || 0);
      }

      const newList = transactionsRes?.list || [];
      if (append) {
        setTransactions(prev => [...prev, ...newList]);
      } else {
        setTransactions(newList);
      }
      setTotal(transactionsRes?.total || 0);
      setHasMore(newList.length === 20);
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, typeFilter, methodFilter, dateFilter]);

  useEffect(() => {
    fetchData(1, false);
  }, [typeFilter, methodFilter, dateFilter]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchData(page + 1, true);
      setPage(prev => prev + 1);
    }
  };

  // 获取交易图标
  const getTypeIcon = () => {
    return (
      <svg className="w-5 h-5" viewBox="0 0 1024 1024" version="1.1">
        <path d="M628.8 928c-144 0-260.8-116.8-260.8-260.8s116.8-260.8 260.8-260.8 260.8 116.8 260.8 260.8c1.6 144-116.8 260.8-260.8 260.8z" fill="currentColor" opacity="0.3" />
        <path d="M256 185.6c-6.4 0-14.4-3.2-17.6-9.6-6.4-9.6-4.8-24 4.8-32 14.4-9.6 44.8-24 60.8-32 11.2-4.8 24-1.6 30.4 9.6s1.6 24-9.6 30.4c-25.6 12.8-46.4 24-54.4 30.4-4.8 1.6-9.6 3.2-14.4 3.2z" fill="currentColor" />
        <path d="M478.4 883.2c-224 0-406.4-182.4-406.4-406.4 0-100.8 36.8-196.8 104-272 8-9.6 22.4-9.6 32-1.6 9.6 8 9.6 22.4 1.6 32-60.8 67.2-92.8 152-92.8 241.6 0 200 161.6 361.6 361.6 361.6 200 0 361.6-161.6 361.6-361.6S678.4 115.2 478.4 115.2c-32 0-62.4 4.8-92.8 12.8-11.2 3.2-24-3.2-27.2-16-3.2-11.2 3.2-24 16-27.2 33.6-9.6 68.8-14.4 105.6-14.4 224 0 406.4 182.4 406.4 406.4-1.6 224-184 406.4-408 406.4z" fill="currentColor" />
        <path d="M478.4 462.4c-6.4 0-14.4-3.2-17.6-9.6l-80-112c-6.4-9.6-4.8-24 4.8-32 9.6-6.4 24-4.8 32 4.8l80 112c6.4 9.6 4.8 24-4.8 32-4.8 3.2-9.6 4.8-14.4 4.8z" fill="currentColor" />
        <path d="M478.4 462.4c-4.8 0-9.6-1.6-12.8-4.8-9.6-6.4-12.8-20.8-4.8-32l80-112c8-9.6 20.8-12.8 32-4.8 9.6 6.4 12.8 20.8 4.8 32l-80 112c-4.8 6.4-11.2 9.6-19.2 9.6z" fill="currentColor" />
        <path d="M630.4 494.4h-304c-12.8 0-22.4-9.6-22.4-22.4s9.6-22.4 22.4-22.4h304c12.8 0 22.4 9.6 22.4 22.4s-9.6 22.4-22.4 22.4zM574.4 606.4h-192c-12.8 0-22.4-9.6-22.4-22.4s9.6-22.4 22.4-22.4h192c12.8 0 22.4 9.6 22.4 22.4s-9.6 22.4-22.4 22.4z" fill="currentColor" />
        <path d="M478.4 782.4c-12.8 0-22.4-9.6-22.4-22.4v-272c0-12.8 9.6-22.4 22.4-22.4s22.4 9.6 22.4 22.4v272c0 12.8-9.6 22.4-22.4 22.4z" fill="currentColor" />
      </svg>
    );
  };

  // 获取图标背景色
  const getTypeColor = (tx: TransactionRecord) => {
    if (tx.amount > 0) {
      return 'bg-green-100 text-green-600';
    }
    return 'bg-red-100 text-red-600';
  };

  // 获取支付方式标签样式
  const getMethodBadgeStyle = (method: string) => {
    switch (method) {
      case 'alipay':
        return 'bg-blue-50 text-blue-600';
      case 'wechat':
        return 'bg-green-50 text-green-600';
      case 'balance':
      default:
        return 'bg-orange-50 text-orange-600';
    }
  };

  // 获取支付方式标签
  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'alipay':
        return '支付宝';
      case 'wechat':
        return '微信';
      case 'balance':
      default:
        return '余额';
    }
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    const prefix = amount > 0 ? '+' : '';
    return `${prefix}${amount.toFixed(2)}`;
  };

  // 处理充值
  const handleRecharge = async () => {
    const amount = Number.parseFloat(rechargeAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      error('请输入正确的金额');
      return;
    }

    setRecharging(true);
    try {
      // 使用balance API处理充值
      const { balanceApi } = await import('../../services/api');
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

  // 点击交易记录
  const handleTransactionClick = (tx: TransactionRecord) => {
    navigate(`/wallet/transaction/${tx.transactionNo}`);
  };

  // 重置筛选
  const resetFilter = () => {
    setTypeFilter('all');
    setMethodFilter('all');
    setDateFilter('all');
    setShowFilter(false);
  };

  // 应用筛选
  const applyFilter = () => {
    setShowFilter(false);
    setPage(1);
  };

  // 按日期分组
  const groupedTransactions = React.useMemo(() => {
    const groups: { date: string; label: string; items: TransactionRecord[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    transactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());

      let dateKey = txDay.toISOString();
      let label = '';

      if (txDay.getTime() === today.getTime()) {
        label = '今天';
      } else if (txDay.getTime() === yesterday.getTime()) {
        label = '昨天';
      } else {
        label = txDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      }

      let group = groups.find(g => g.date === dateKey);
      if (!group) {
        group = { date: dateKey, label, items: [] };
        groups.push(group);
      }
      group.items.push(tx);
    });

    return groups;
  }, [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="bg-gradient-to-br from-brand-primary to-brand-primary-dark text-white px-6 pt-6 pb-12 rounded-b-[32px]">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">我的钱包</h1>
            <div className="w-10" />
          </div>

          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">账户余额（元）</p>
            <p className="text-5xl font-display font-bold">{balance.toFixed(2)}</p>
          </div>
        </div>

        {/* 充值按钮 */}
        <div className="px-6 -mt-6">
          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowRecharge(true)}
            icon={<Icons.Plus className="w-5 h-5" />}
          >
            充值余额
          </Button>

          {/* 交易记录 */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">交易记录</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">共 {total} 条</span>
                <button
                  onClick={() => setShowFilter(true)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    (typeFilter !== 'all' || methodFilter !== 'all')
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  <Icons.Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <EmptyState
                icon={<Icons.History className="w-16 h-16" />}
                title="暂无交易记录"
              />
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map(group => (
                  <div key={group.date}>
                    <p className="text-xs text-slate-400 mb-2 px-1">{group.label}</p>
                    <div className="space-y-2">
                      {group.items.map(tx => (
                        <Card
                          key={tx.id}
                          className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleTransactionClick(tx)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', getTypeColor(tx))}>
                                {getTypeIcon()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 min-w-[4em]">{tx.typeLabel}</span>
                                  <span className={cn('text-xs px-1.5 py-0.5 rounded whitespace-nowrap', getMethodBadgeStyle(tx.paymentMethod))}>
                                    {getMethodLabel(tx.paymentMethod)}
                                  </span>
                                </div>
                                {tx.productName && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{tx.productName}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex items-center gap-2">
                              <p className={cn(
                                'text-base font-bold',
                                tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                              )}>
                                {formatAmount(tx.amount)}
                              </p>
                              <Icons.ChevronRight className="w-4 h-4 text-slate-300" />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}

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

        {/* 充值弹窗 */}
        <AnimatePresence>
          {showRecharge && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <button type="button" className="absolute inset-0 bg-black/50 cursor-default" onClick={() => setShowRecharge(false)} aria-label="关闭" />
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
                      className={cn(
                        'flex-1 py-2 rounded-xl text-sm font-medium transition-colors',
                        rechargeAmount === amount.toString()
                          ? 'bg-brand-primary text-white'
                          : 'bg-slate-100 text-slate-600'
                      )}
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
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors',
                          paymentMethod === 'alipay' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100'
                        )}
                      >
                        <Icons.Alipay className="w-6 h-6 text-blue-500" />
                        <span className="font-medium">支付宝</span>
                        {paymentMethod === 'alipay' && <Icons.Check className="w-5 h-5 text-brand-primary ml-auto" />}
                      </button>
                    )}
                    {paymentConfig.wechatEnabled && (
                      <button
                        onClick={() => setPaymentMethod('wechat')}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors',
                          paymentMethod === 'wechat' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100'
                        )}
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
        </AnimatePresence>

        {/* 筛选弹窗 */}
        <AnimatePresence>
          {showFilter && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <button type="button" className="absolute inset-0 bg-black/50 cursor-default" onClick={() => setShowFilter(false)} aria-label="关闭" />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="relative w-full max-w-lg bg-white rounded-t-3xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">筛选</h3>
                  <button onClick={() => setShowFilter(false)} className="text-slate-400">
                    <Icons.X className="w-6 h-6" />
                  </button>
                </div>

                {/* 交易类型 */}
                <div className="mb-6">
                  <p className="text-sm text-slate-500 mb-3">交易类型</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'payment', label: '支付' },
                      { key: 'refund', label: '退款' },
                      { key: 'recharge', label: '充值' },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => setTypeFilter(item.key as TransactionType)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          typeFilter === item.key
                            ? 'bg-brand-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 支付方式 */}
                <div className="mb-6">
                  <p className="text-sm text-slate-500 mb-3">支付方式</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'balance', label: '余额' },
                      { key: 'alipay', label: '支付宝' },
                      { key: 'wechat', label: '微信' },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => setMethodFilter(item.key as PaymentMethod)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          methodFilter === item.key
                            ? 'bg-brand-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 时间范围 */}
                <div className="mb-6">
                  <p className="text-sm text-slate-500 mb-3">时间范围</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'today', label: '今天' },
                      { key: 'week', label: '近7天' },
                      { key: 'month', label: '近30天' },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => setDateFilter(item.key as DateRange)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          dateFilter === item.key
                            ? 'bg-brand-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={resetFilter}>
                    重置
                  </Button>
                  <Button className="flex-1" onClick={applyFilter}>
                    确定
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

export default WalletPage;