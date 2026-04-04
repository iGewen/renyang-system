import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Icons, PageTransition, LoadingSpinner, Button, Badge, Card, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adoptionApi } from '../../services/api';
import type { Adoption, FeedBill } from '../../types';

const AdoptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [feedBills, setFeedBills] = useState<FeedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'bills'>('info');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [adoptionData, billsData] = await Promise.all([
          adoptionApi.getById(id),
          adoptionApi.getFeedBills(id)
        ]);
        setAdoption(adoptionData);
        setFeedBills(billsData);
      } catch (error) {
        console.error('Failed to fetch adoption details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; color: string }> = {
      active: { label: '领养中', variant: 'success', color: 'text-green-600 bg-green-50' },
      feed_overdue: { label: '饲料费逾期', variant: 'danger', color: 'text-red-600 bg-red-50' },
      exception: { label: '异常', variant: 'danger', color: 'text-red-600 bg-red-50' },
      redeemable: { label: '可买断', variant: 'info', color: 'text-blue-600 bg-blue-50' },
      redemption_pending: { label: '买断审核中', variant: 'warning', color: 'text-orange-600 bg-orange-50' },
      redeemed: { label: '已买断', variant: 'default', color: 'text-slate-600 bg-slate-100' },
      terminated: { label: '已终止', variant: 'default', color: 'text-slate-600 bg-slate-100' }
    };
    return map[status] || { label: status, variant: 'default', color: 'text-slate-600 bg-slate-100' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
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

  const statusConfig = getStatusConfig(adoption.status);
  const livestock = adoption.livestockSnapshot || adoption.livestock;

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
            <button
              onClick={() => setActiveTab('info')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-colors',
                activeTab === 'info' ? 'bg-brand-primary text-white' : 'text-slate-500'
              )}
            >
              基本信息
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-colors',
                activeTab === 'bills' ? 'bg-brand-primary text-white' : 'text-slate-500'
              )}
            >
              饲料费账单
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 mt-6">
          {activeTab === 'info' ? (
            <div className="space-y-4">
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
                    <span className={cn('font-bold', adoption.lateFeeAmount > 0 ? 'text-red-500' : 'text-slate-900')}>
                      ¥{adoption.lateFeeAmount || 0}
                    </span>
                  </div>
                </div>
              </Card>

              {(adoption.status === 'redeemable' || adoption.status === 'active') && (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate(`/adoption/${id}/redemption`)}
                  icon={<Icons.CheckCircle2 className="w-5 h-5" />}
                >
                  申请买断
                </Button>
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
          ) : (
            <div className="space-y-4">
              {feedBills.length === 0 ? (
                <EmptyState icon={<Icons.FileText className="w-16 h-16" />} title="暂无饲料费账单" />
              ) : (
                feedBills.map(bill => {
                  const billStatusConfig = {
                    pending: { label: '待支付', color: 'text-orange-600 bg-orange-50' },
                    paid: { label: '已支付', color: 'text-green-600 bg-green-50' },
                    overdue: { label: '已逾期', color: 'text-red-600 bg-red-50' },
                    waived: { label: '已免除', color: 'text-slate-600 bg-slate-100' }
                  }[bill.status] || { label: bill.status, color: 'text-slate-600 bg-slate-100' };

                  return (
                    <Card key={bill.id} className="p-4" onClick={() => navigate(`/feed-bill/${bill.id}`)}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">{bill.billMonth} 月账单</span>
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', billStatusConfig.color)}>
                          {billStatusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-500 text-xs">账单金额</p>
                          <p className="text-xl font-bold text-brand-primary">
                            ¥{bill.adjustedAmount || bill.originalAmount}
                          </p>
                        </div>
                        {bill.lateFeeAmount > 0 && (
                          <div className="text-right">
                            <p className="text-slate-500 text-xs">滞纳金</p>
                            <p className="text-sm font-bold text-red-500">¥{bill.lateFeeAmount}</p>
                          </div>
                        )}
                      </div>
                      {bill.status === 'pending' && (
                        <Button
                          size="sm"
                          className="w-full mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/feed-bill/${bill.id}/pay`);
                          }}
                        >
                          立即支付
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default AdoptionDetailPage;
