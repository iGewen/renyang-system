import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons, PageTransition, LoadingSpinner, Button, Card } from '../../components/ui';
import { cn } from '../../lib/utils';
import { adoptionApi } from '../../services/api';
import type { Adoption } from '../../types';

const RedemptionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; redemptionNo?: string; amount?: number; error?: string } | null>(null);

  useEffect(() => {
    const fetchAdoption = async () => {
      if (!id) return;
      try {
        const data = await adoptionApi.getById(id);
        setAdoption(data);
      } catch (error) {
        console.error('Failed to fetch adoption:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAdoption();
  }, [id]);

  const handleApply = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const result = await adoptionApi.applyRedemption(id);
      setSubmitResult({
        success: true,
        redemptionNo: result.redemptionNo,
        amount: result.amount,
      });
      setShowConfirmModal(false);
    } catch (error: any) {
      setSubmitResult({
        success: false,
        error: error.message || '申请失败，请重试',
      });
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  if (loading) return <LoadingSpinner />;

  // 显示提交结果页面
  if (submitResult) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <Card className="p-8 text-center">
              {submitResult.success ? (
                <>
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icons.CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">买断申请已提交</h2>
                  <p className="text-slate-500 text-sm mb-6">请等待管理员审核，审核通过后将以短信通知您</p>

                  <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm">买断编号</span>
                      <span className="font-mono text-slate-900">{submitResult.redemptionNo}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500 text-sm">买断金额</span>
                      <span className="font-bold text-brand-primary">¥{submitResult.amount?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icons.X className="w-10 h-10 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">申请失败</h2>
                  <p className="text-slate-500 text-sm mb-6">{submitResult.error}</p>
                </>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate(`/adoption/${id}`)}>
                  返回详情
                </Button>
                {submitResult.success && (
                  <Button className="flex-1" onClick={() => navigate('/my-adoptions')}>
                    查看我的牧场
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  if (!adoption) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg flex items-center justify-center">
          <p className="text-slate-400">领养记录不存在</p>
        </div>
      </PageTransition>
    );
  }

  const livestock = adoption.livestockSnapshot || adoption.livestock;
  const isFullTerm = (adoption.days || 0) >= adoption.redemptionMonths * 30;
  const redemptionType = isFullTerm ? '满期买断' : '提前买断';
  const redemptionAmount = livestock?.price || 0;

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-32">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">申请买断</h1>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="px-6 mt-6 space-y-4">
          {/* Livestock Info */}
          <Card className="p-6">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                {livestock?.mainImage && (
                  <img src={livestock.mainImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">{livestock?.name}</h3>
                <p className="text-sm text-slate-500 mt-1">编号: {adoption.adoptionNo}</p>
                <p className="text-sm text-slate-500 mt-1">已领养: {adoption.days || 0} 天</p>
              </div>
            </div>
          </Card>

          {/* Redemption Info */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">买断信息</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-50">
                <span className="text-slate-500">买断类型</span>
                <span className="text-slate-900">{redemptionType}</span>
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
                <span className="text-slate-500">领养价格</span>
                <span className="text-slate-900">¥{livestock?.price || 0}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-500">买断金额</span>
                <span className="text-xl font-bold text-brand-primary">¥{redemptionAmount}</span>
              </div>
            </div>
          </Card>

          {/* Notice */}
          <Card className="p-6 bg-amber-50 border-amber-100">
            <div className="flex items-start gap-4">
              <Icons.Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium mb-2">买断说明</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>满期买断：领养期满后可申请，无需审核</li>
                  <li>提前买断：领养期内申请，需管理员审核</li>
                  <li>买断后活体将送达您指定的地址</li>
                  <li>如有疑问请联系客服</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Agreement */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setAgreed(!agreed)}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 mt-0.5 transition-colors',
                agreed ? 'bg-brand-primary border-brand-primary text-white' : 'border-slate-300'
              )}
            >
              {agreed && <Icons.Check className="w-3.5 h-3.5" />}
            </button>
            <span className="text-sm text-slate-500">
              我已阅读并同意 <span className="text-brand-primary font-medium cursor-pointer">《买断服务协议》</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto">
            <div>
              <p className="text-xs text-slate-400">应付金额</p>
              <p className="text-2xl font-display font-bold text-brand-primary">¥{redemptionAmount}</p>
            </div>
            <Button
              size="lg"
              disabled={!agreed}
              onClick={() => setShowConfirmModal(true)}
              className="disabled:opacity-50"
            >
              提交申请
            </Button>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmModal(false)} />
            <Card className="relative w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">确认买断申请</h3>
              <p className="text-slate-500 text-sm mb-6">
                您确定要提交买断申请吗？{!isFullTerm && '提前买断需要管理员审核，请耐心等待。'}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                  取消
                </Button>
                <Button className="flex-1" onClick={handleApply} loading={submitting}>
                  确认
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default RedemptionPage;
