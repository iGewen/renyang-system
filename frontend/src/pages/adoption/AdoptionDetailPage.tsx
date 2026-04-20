import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Card, EmptyState, useToast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adoptionApi, redemptionApi, balanceApi } from '../../services/api';
import { FeedBillStatus, RedemptionStatus } from '../../types/enums';
import type { Adoption, FeedBill, RedemptionOrder, Livestock } from '../../types';
import { usePaymentConfig } from '../../contexts/SiteConfigContext';

// 状态配置映射
const STATUS_CONFIG: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; color: string }> = {
  1: { label: '领养中', variant: 'success', color: 'text-green-600 bg-green-50' },
  2: { label: '饲料费逾期', variant: 'danger', color: 'text-red-600 bg-red-50' },
  3: { label: '异常', variant: 'danger', color: 'text-red-600 bg-red-50' },
  4: { label: '可买断', variant: 'info', color: 'text-blue-600 bg-blue-50' },
  5: { label: '买断审核中', variant: 'warning', color: 'text-orange-600 bg-orange-50' },
  6: { label: '已买断', variant: 'default', color: 'text-slate-600 bg-slate-100' },
  7: { label: '已终止', variant: 'default', color: 'text-slate-600 bg-slate-100' }
};

const BILL_STATUS_CONFIG: Record<number, { label: string; color: string }> = {
  [FeedBillStatus.PENDING]: { label: '待支付', color: 'text-orange-600 bg-orange-50' },
  [FeedBillStatus.PAID]: { label: '已支付', color: 'text-green-600 bg-green-50' },
  [FeedBillStatus.OVERDUE]: { label: '已逾期', color: 'text-red-600 bg-red-50' },
  [FeedBillStatus.WAIVED]: { label: '已免除', color: 'text-slate-600 bg-slate-100' }
};

const REDEMPTION_STATUS_CONFIG: Record<number, { label: string; color: string }> = {
  [RedemptionStatus.PENDING_AUDIT]: { label: '待审核', color: 'text-orange-600 bg-orange-50' },
  [RedemptionStatus.AUDIT_PASSED]: { label: '审核通过，待支付', color: 'text-green-600 bg-green-50' },
  [RedemptionStatus.AUDIT_REJECTED]: { label: '审核拒绝', color: 'text-red-600 bg-red-50' },
  [RedemptionStatus.PAID]: { label: '已支付', color: 'text-slate-600 bg-slate-100' },
  [RedemptionStatus.CANCELLED]: { label: '已取消', color: 'text-slate-600 bg-slate-100' }
};

// 工具函数
const getStatusConfig = (status: number, redemptionStatus?: number) => {
  if (status === 5 && redemptionStatus === RedemptionStatus.AUDIT_PASSED) {
    return { label: '待支付', variant: 'info', color: 'text-blue-600 bg-blue-50' };
  }
  return STATUS_CONFIG[status] || { label: '未知', variant: 'default', color: 'text-slate-600 bg-slate-100' };
};

const getBillStatusConfig = (status: number) => BILL_STATUS_CONFIG[status] || { label: '未知', color: 'text-slate-600 bg-slate-100' };
const getRedemptionStatusConfig = (status: number) => REDEMPTION_STATUS_CONFIG[status] || { label: '未知', color: 'text-slate-600 bg-slate-100' };
const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('zh-CN');

// 饲料费账单卡片组件
const FeedBillCard: React.FC<{ bill: FeedBill; navigate: (path: string) => void }> = ({ bill, navigate }) => {
  const billStatusConfig = getBillStatusConfig(bill.status);

  return (
    <Card className="p-4" onClick={() => navigate(`/feed-bill/${bill.id}`)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{bill.billMonth} 月账单</span>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', billStatusConfig.color)}>
          {billStatusConfig.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">账单金额</p>
          <p className="text-xl font-bold text-brand-primary">¥{bill.adjustedAmount ?? bill.originalAmount}</p>
        </div>
        {Number(bill.lateFeeAmount || 0) > 0 && (
          <div className="text-right">
            <p className="text-slate-500 text-xs">滞纳金</p>
            <p className="text-sm font-bold text-red-500">¥{Number(bill.lateFeeAmount).toFixed(2)}</p>
          </div>
        )}
      </div>
      {bill.status === FeedBillStatus.PENDING && (
        <Button size="sm" className="w-full mt-3" onClick={(e) => { e.stopPropagation(); navigate(`/feed-bill/${bill.id}`); }}>
          立即支付
        </Button>
      )}
    </Card>
  );
};

// 领养信息卡片组件
const AdoptionInfoCard: React.FC<{ adoption: Adoption; livestock: Partial<Livestock> }> = ({ adoption, livestock }) => (
  <Card className="p-6">
    <h3 className="text-lg font-bold text-slate-900 mb-4">领养信息</h3>
    <div className="space-y-4">
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">领养编号</span>
        <span className="font-mono text-slate-900">{adoption.adoptionNo}</span>
      </div>
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">开始日期</span>
        <span className="text-slate-900">{formatDate(adoption.startDate)}</span>
      </div>
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">领养时长</span>
        <span className="text-slate-900">{adoption.redemptionMonths} 个月</span>
      </div>
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">已领养天数</span>
        <span className="font-bold text-brand-primary">{adoption.days || 0} 天</span>
      </div>
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">已缴月数</span>
        <span className="font-bold text-brand-primary">{adoption.feedMonthsPaid} 月</span>
      </div>
      <div className="flex justify-between items-center py-3 border-b border-slate-50">
        <span className="text-slate-500">月饲料费</span>
        <span className="text-slate-900">¥{livestock?.monthlyFeedFee || 0}</span>
      </div>
      <div className="flex justify-between items-center py-3">
        <span className="text-slate-500">滞纳金</span>
        <span className={cn('font-bold', Number(adoption.lateFeeAmount || 0) > 0 ? 'text-red-500' : 'text-slate-900')}>
          ¥{Number(adoption.lateFeeAmount || 0).toFixed(2)}
        </span>
      </div>
    </div>
  </Card>
);

// 买断进度卡片组件
const RedemptionProgressCard: React.FC<{
  redemption: RedemptionOrder;
  onPay: () => void;
  paying: boolean;
}> = ({ redemption, onPay, paying }) => {
  const canPay = redemption.status === RedemptionStatus.AUDIT_PASSED && Number(redemption.finalAmount || 0) > 0;
  const isFreeRedemption = redemption.status === RedemptionStatus.AUDIT_PASSED && Number(redemption.finalAmount || 0) === 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">买断进度</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-3 border-b border-slate-50">
          <span className="text-slate-500">买断编号</span>
          <span className="font-mono text-slate-900">{redemption.redemptionNo}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-slate-50">
          <span className="text-slate-500">买断类型</span>
          <span className="text-slate-900">
            {redemption.type === 1 || String(redemption.type) === 'full' ? '满期买断' : '提前买断'}
          </span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-slate-50">
          <span className="text-slate-500">买断金额</span>
          <span className="font-bold text-brand-primary">¥{Number(redemption.finalAmount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="text-slate-500">状态</span>
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium', getRedemptionStatusConfig(redemption.status).color)}>
            {getRedemptionStatusConfig(redemption.status).label}
          </span>
        </div>
        {redemption.auditRemark && (
          <div className="py-3 border-t border-slate-50">
            <span className="text-slate-500 text-sm">审核备注</span>
            <p className="text-slate-700 mt-1">{redemption.auditRemark}</p>
          </div>
        )}
      </div>
      {canPay && (
        <Button className="w-full mt-4" size="lg" onClick={onPay} loading={paying} icon={<Icons.CreditCard className="w-5 h-5" />}>
          立即支付 ¥{Number(redemption.finalAmount || 0).toFixed(2)}
        </Button>
      )}
      {isFreeRedemption && (
        <div className="mt-4 p-4 bg-green-50 rounded-xl text-center">
          <p className="text-green-600 font-medium">买断申请已通过，无需支付额外费用</p>
          <p className="text-green-500 text-sm mt-1">请等待工作人员联系您安排发货</p>
        </div>
      )}
    </Card>
  );
};

// 支付方式选择弹窗组件
const PaymentMethodModal: React.FC<{
  visible: boolean;
  redemption: RedemptionOrder | null;
  balance: number;
  paymentMethod: 'alipay' | 'wechat' | 'balance' | null;
  paying: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'alipay' | 'wechat' | 'balance') => void;
  onConfirm: () => void;
  paymentConfig: { alipayEnabled: boolean; wechatEnabled: boolean };
}> = ({ visible, redemption, balance, paymentMethod, paying, onClose, onSelectMethod, onConfirm, paymentConfig }) => {
  if (!visible || !redemption) return null;

  const paymentMethods = [
    ...(paymentConfig.alipayEnabled ? [{ key: 'alipay' as const, icon: Icons.Alipay, label: '支付宝', color: 'text-blue-500' }] : []),
    ...(paymentConfig.wechatEnabled ? [{ key: 'wechat' as const, icon: Icons.Wechat, label: '微信支付', color: 'text-green-500' }] : []),
    { key: 'balance' as const, icon: Icons.Wallet, label: `余额支付 (¥${balance.toFixed(2)})`, color: 'text-brand-primary', disabled: balance < Number(redemption.finalAmount || 0) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="relative w-full max-w-lg bg-white rounded-t-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">选择支付方式</h3>
          <button onClick={onClose} className="text-slate-400"><Icons.X className="w-6 h-6" /></button>
        </div>
        <div className="text-center mb-6">
          <p className="text-slate-500 text-sm">支付金额</p>
          <p className="text-3xl font-display font-bold text-brand-primary">¥{Number(redemption.finalAmount || 0).toFixed(2)}</p>
        </div>
        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <button
              key={method.key}
              onClick={() => onSelectMethod(method.key)}
              disabled={method.disabled}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors',
                paymentMethod === method.key ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100',
                method.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <method.icon className={cn('w-6 h-6', method.color)} />
              <span className="flex-1 text-left font-medium">{method.label}</span>
              {paymentMethod === method.key && <Icons.Check className="w-5 h-5 text-brand-primary" />}
            </button>
          ))}
        </div>
        <Button className="w-full mt-6" size="lg" onClick={onConfirm} loading={paying} disabled={!paymentMethod}>
          {paymentMethod ? '确认支付' : '请选择支付方式'}
        </Button>
      </motion.div>
    </div>
  );
};

const AdoptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [feedBills, setFeedBills] = useState<FeedBill[]>([]);
  const [redemption, setRedemption] = useState<RedemptionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat' | 'balance' | null>(null);
  const [balance, setBalance] = useState(0);
  const paymentConfig = usePaymentConfig();
  const [activeTab, setActiveTab] = useState<'info' | 'bills'>(() => searchParams.get('tab') === 'bills' ? 'bills' : 'info');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const adoptionData = await fetchAdoptionData(id);
        if (!adoptionData) {
          setLoading(false);
          return;
        }

        const billsData = await adoptionApi.getFeedBills(adoptionData.id);
        setAdoption(adoptionData);
        setFeedBills(billsData);

        if (adoptionData.status === 5) {
          await fetchRedemptionData(adoptionData.id);
        }
      } catch (err) {
        console.error('Failed to fetch adoption details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const fetchAdoptionData = async (id: string): Promise<Adoption | null> => {
    try {
      return await adoptionApi.getById(id);
    } catch (e: any) {
      if (e.message?.includes('不存在') || e.message?.includes('404')) {
        try {
          return await adoptionApi.getByOrderId(id);
        } catch (e2) {
          console.error('Failed to fetch adoption by order id:', e2);
          return null;
        }
      }
      throw e;
    }
  };

  const fetchRedemptionData = async (adoptionId: string) => {
    try {
      const redemptions = await redemptionApi.getMyRedemptions();
      const activeRedemption = redemptions.find(r =>
        r.adoptionId === adoptionId && (r.status === RedemptionStatus.PENDING_AUDIT || r.status === RedemptionStatus.AUDIT_PASSED)
      );
      if (activeRedemption) setRedemption(activeRedemption);
    } catch (e) {
      console.error('Failed to fetch redemption:', e);
    }
  };

  const handlePayRedemption = async () => {
    if (!redemption) return;
    try {
      const balanceRes = await balanceApi.get();
      setBalance(Number(balanceRes?.balance) || 0);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
    setShowPaymentModal(true);
  };

  const confirmPayRedemption = async () => {
    if (!redemption || !paymentMethod) {
      error('请选择支付方式');
      return;
    }
    setPaying(true);
    try {
      const result = await redemptionApi.pay(redemption.id, paymentMethod);
      if (result.success) {
        success('支付成功！');
        setShowPaymentModal(false);
        globalThis.location.reload();
        return;
      }
      if (result.payUrl) {
        globalThis.location.href = result.payUrl;
      }
    } catch (err: any) {
      error(err.message || '支付失败');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!adoption) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex items-center justify-center">
          <EmptyState icon={<Icons.Package className="w-16 h-16" />} title="领养记录不存在" />
        </div>
      </PageTransition>
    );
  }

  const statusConfig = getStatusConfig(adoption.status, redemption?.status);
  const livestock: Partial<Livestock> = (adoption.livestockSnapshot || adoption.livestock) as Partial<Livestock> || {};

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* Header */}
        <div className="bg-brand-primary text-white px-6 pt-6 pb-12 rounded-b-[32px]">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">领养详情</h1>
            <div className="w-10" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10">
              {livestock?.mainImage && (
                <img src={livestock.mainImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-display font-bold">{livestock?.name || '未知'}</h2>
              <p className="text-white/70 text-sm mt-1">编号: {adoption.adoptionNo}</p>
              <span className={cn('inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium', statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 -mt-6">
          <div className="bg-white rounded-2xl shadow-sm flex p-1">
            <button onClick={() => setActiveTab('info')} className={cn('flex-1 py-3 rounded-xl text-sm font-medium transition-colors', activeTab === 'info' ? 'bg-brand-primary text-white' : 'text-slate-500')}>基本信息</button>
            <button onClick={() => setActiveTab('bills')} className={cn('flex-1 py-3 rounded-xl text-sm font-medium transition-colors', activeTab === 'bills' ? 'bg-brand-primary text-white' : 'text-slate-500')}>饲料费账单</button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 mt-6">
          {activeTab === 'info' ? (
            <InfoTabContent adoption={adoption} redemption={redemption} livestock={livestock} navigate={navigate} paying={paying} onPayRedemption={handlePayRedemption} />
          ) : (
            <BillsTabContent feedBills={feedBills} navigate={navigate} />
          )}
        </div>

        <PaymentMethodModal
          visible={showPaymentModal}
          redemption={redemption}
          balance={balance}
          paymentMethod={paymentMethod}
          paying={paying}
          onClose={() => setShowPaymentModal(false)}
          onSelectMethod={setPaymentMethod}
          onConfirm={confirmPayRedemption}
          paymentConfig={paymentConfig}
        />
      </div>
    </PageTransition>
  );
};

// 信息标签页内容组件
const InfoTabContent: React.FC<{
  adoption: Adoption;
  redemption: RedemptionOrder | null;
  livestock: Partial<Livestock>;
  navigate: (path: string) => void;
  paying: boolean;
  onPayRedemption: () => void;
}> = ({ adoption, redemption, livestock, navigate, paying, onPayRedemption }) => (
  <div className="space-y-4">
    <AdoptionInfoCard adoption={adoption} livestock={livestock} />
    {(adoption.status === 4 || adoption.status === 1) && (
      <Button className="w-full" size="lg" onClick={() => navigate(`/adoption/${adoption.id}/redemption`)} icon={<Icons.CheckCircle2 className="w-5 h-5" />}>申请买断</Button>
    )}
    {adoption.status === 5 && redemption && (
      <RedemptionProgressCard redemption={redemption} onPay={onPayRedemption} paying={paying} />
    )}
    {adoption.isException && (
      <Card className="p-6 bg-red-50 border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Icons.AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h4 className="font-bold text-red-700">异常状态</h4>
            <p className="text-sm text-red-600 mt-1">{adoption.exceptionReason || '请联系客服处理'}</p>
          </div>
        </div>
      </Card>
    )}
  </div>
);

// 账单标签页内容组件
const BillsTabContent: React.FC<{ feedBills: FeedBill[]; navigate: (path: string) => void }> = ({ feedBills, navigate }) => (
  <div className="space-y-4">
    {feedBills.length === 0 ? (
      <EmptyState icon={<Icons.FileText className="w-16 h-16" />} title="暂无饲料费账单" />
    ) : (
      feedBills.map(bill => <FeedBillCard key={bill.id} bill={bill} navigate={navigate} />)
    )}
  </div>
);

export default AdoptionDetailPage;
