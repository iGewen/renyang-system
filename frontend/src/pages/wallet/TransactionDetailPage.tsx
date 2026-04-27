/**
 * TransactionDetailPage.tsx - 交易详情页面
 * 类似微信账单详情页风格
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Button, useToast, LoadingSpinner } from '../../components/ui';
import { cn } from '../../lib/utils';
import { walletApi, type TransactionDetail } from '../../services/wallet.api';

export const TransactionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { transactionNo } = useParams<{ transactionNo: string }>();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (transactionNo) {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionNo]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await walletApi.getTransactionDetail(transactionNo!);
      setDetail(data);
    } catch (err: any) {
      toast.error(err.message || '获取交易详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  // 获取状态标签样式
  const getStatusStyle = (status: number) => {
    switch (status) {
      case 2: // 成功
        return 'bg-green-100 text-green-600';
      case 1: // 待支付
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  // 获取支付方式标签样式
  const getMethodStyle = (method: string) => {
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

  // 获取支付方式显示名
  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'alipay':
        return '支付宝';
      case 'wechat':
        return '微信支付';
      case 'balance':
      default:
        return '余额';
    }
  };

  // 格式化时间
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 跳转到关联页面
  const goToOrder = () => {
    if (detail?.orderNo) {
      navigate(`/orders/${detail.orderNo}`);
    }
  };

  const goToAdoption = () => {
    if (detail?.adoptionNo) {
      navigate(`/adoption/${detail.adoptionNo}`);
    }
  };

  const goToRefund = () => {
    if (detail?.refundNo) {
      navigate(`/refund/${detail.refundNo}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <LoadingSpinner />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <Icons.AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">交易记录不存在</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>
    );
  }

  const amount = Math.abs(detail.amount);
  const isIncome = detail.amount > 0;

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg">
        {/* 头部 */}
        <div className="bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-base font-medium">交易详情</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* 金额展示区 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white mt-2 px-6 py-8 text-center"
        >
          <p className="text-slate-500 text-sm mb-2">{detail.typeLabel}</p>
          <p className={cn(
            'text-4xl font-bold',
            isIncome ? 'text-green-600' : 'text-slate-900'
          )}>
            {isIncome ? '+' : '-'}¥{amount.toFixed(2)}
          </p>
          <div className={cn(
            'inline-block mt-3 px-3 py-1 rounded-full text-sm',
            getStatusStyle(detail.status)
          )}>
            {detail.statusLabel}
          </div>
        </motion.div>

        {/* 交易信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white mt-2 px-6 py-4"
        >
          <h2 className="text-base font-medium text-slate-900 mb-4">交易信息</h2>
          <div className="space-y-4">
            {/* 交易类型 */}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">交易类型</span>
              <span className="text-slate-900">{detail.typeLabel}</span>
            </div>

            {/* 支付方式 */}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">支付方式</span>
              <span className={cn('px-2 py-0.5 rounded text-xs', getMethodStyle(detail.paymentMethod))}>
                {getMethodLabel(detail.paymentMethod)}
              </span>
            </div>

            {/* 交易时间 */}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">交易时间</span>
              <span className="text-slate-900 text-sm">{formatDateTime(detail.createdAt)}</span>
            </div>

            {/* 交易单号 */}
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">交易单号</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 text-sm font-mono">{detail.transactionNo}</span>
                <button
                  onClick={() => copyToClipboard(detail.transactionNo)}
                  className="text-brand-primary text-sm"
                >
                  复制
                </button>
              </div>
            </div>

            {/* 商品名称 */}
            {detail.productName && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">商品名称</span>
                <span className="text-slate-900">{detail.productName}</span>
              </div>
            )}

            {/* 关联订单号 */}
            {detail.orderNo && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">商户订单号</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-sm font-mono">{detail.orderNo}</span>
                  <button
                    onClick={() => copyToClipboard(detail.orderNo!)}
                    className="text-brand-primary text-sm"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            {/* 关联领养编号 */}
            {detail.adoptionNo && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">关联领养</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-sm font-mono">{detail.adoptionNo}</span>
                  <button
                    onClick={() => copyToClipboard(detail.adoptionNo!)}
                    className="text-brand-primary text-sm"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            {/* 买断编号 */}
            {detail.redemptionNo && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">买断单号</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-sm font-mono">{detail.redemptionNo}</span>
                  <button
                    onClick={() => copyToClipboard(detail.redemptionNo!)}
                    className="text-brand-primary text-sm"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            {/* 退款编号 */}
            {detail.refundNo && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">退款单号</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-sm font-mono">{detail.refundNo}</span>
                  <button
                    onClick={() => copyToClipboard(detail.refundNo!)}
                    className="text-brand-primary text-sm"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            {/* 退款原因 */}
            {detail.refundReason && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">退款原因</span>
                <span className="text-slate-900">{detail.refundReason}</span>
              </div>
            )}

            {/* 第三方交易号 */}
            {detail.transactionId && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">平台流水号</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 text-xs font-mono max-w-[180px] truncate">{detail.transactionId}</span>
                  <button
                    onClick={() => copyToClipboard(detail.transactionId!)}
                    className="text-brand-primary text-sm flex-shrink-0"
                  >
                    复制
                  </button>
                </div>
              </div>
            )}

            {/* 余额变动（退款/调整时显示） */}
            {detail.balanceBefore !== undefined && detail.balanceAfter !== undefined && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">余额变动</span>
                <span className="text-slate-900 text-sm">
                  {detail.balanceBefore.toFixed(2)} → {detail.balanceAfter.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* 操作按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white mt-2 px-6 py-4 space-y-3"
        >
          {/* 复制交易单号 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => copyToClipboard(detail.transactionNo)}
            icon={<Icons.Copy className="w-4 h-4" />}
          >
            复制交易单号
          </Button>

          {/* 查看关联订单 */}
          {detail.orderNo && (
            <Button
              variant="outline"
              className="w-full"
              onClick={goToOrder}
              icon={<Icons.FileText className="w-4 h-4" />}
            >
              查看关联订单
            </Button>
          )}

          {/* 查看领养详情 */}
          {detail.adoptionNo && (
            <Button
              variant="outline"
              className="w-full"
              onClick={goToAdoption}
              icon={<Icons.Heart className="w-4 h-4" />}
            >
              查看领养详情
            </Button>
          )}

          {/* 查看退款详情 */}
          {detail.refundNo && (
            <Button
              variant="outline"
              className="w-full"
              onClick={goToRefund}
              icon={<Icons.RotateCw className="w-4 h-4" />}
            >
              查看退款详情
            </Button>
          )}
        </motion.div>

        {/* 温馨提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="px-6 py-4"
        >
          <p className="text-xs text-slate-400 text-center">
            如有疑问，请复制交易单号联系客服处理
          </p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default TransactionDetailPage;