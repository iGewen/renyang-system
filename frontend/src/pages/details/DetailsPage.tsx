import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icons, PageTransition, LoadingSpinner, Modal } from '../../components/ui';
import { cn } from '../../lib/utils';
import { livestockApi, orderApi, agreementApi } from '../../services/api';
import type { Livestock } from '../../types';

const DetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState<Livestock | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementContent, setAgreementContent] = useState<{ title: string; content: string } | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        const data = await livestockApi.getById(id);
        if (data) setLivestock(data);
      } catch (error) {
        console.error('Failed to fetch livestock details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleShowAgreement = async () => {
    setLoadingAgreement(true);
    setShowAgreement(true);
    try {
      const data = await agreementApi.get('adoption');
      setAgreementContent(data);
    } catch (error) {
      console.debug('获取协议失败，使用默认内容:', error);
      setAgreementContent({
        title: '云端牧场领养协议',
        content: '暂无协议内容，请联系管理员配置。',
      });
    } finally {
      setLoadingAgreement(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setCreatingOrder(true);
    try {
      const clientOrderId = `CLIENT-${crypto.randomUUID().replaceAll('-', '').substring(0, 16).toUpperCase()}`;
      const order = await orderApi.create({ livestockId: id, clientOrderId });
      navigate(`/payment?orderId=${order.id}`);
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!livestock) return <div className="flex justify-center items-center h-screen text-slate-400">活体不存在</div>;

  return (
    <PageTransition>
      <div className="min-h-screen pb-32">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">领养确认</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="premium-card overflow-hidden h-[400px] lg:h-[600px]">
                <img src={livestock.mainImage || livestock.images?.[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={livestock.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="premium-card p-6 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-3"><Icons.Award className="w-5 h-5" /></div>
                  <h5 className="text-xs font-bold mb-1">品质认证</h5>
                  <p className="text-[10px] text-slate-400">纯种优良基因</p>
                </div>
                <div className="premium-card p-6 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-3"><Icons.Leaf className="w-5 h-5" /></div>
                  <h5 className="text-xs font-bold mb-1">绿色生态</h5>
                  <p className="text-[10px] text-slate-400">自然散养环境</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div className="premium-card p-8 mb-8 flex-1">
                <div className="mb-8">
                  <h3 className="text-4xl font-display font-bold text-brand-primary mb-2">{livestock.name}</h3>
                  <div className="flex items-center gap-1 text-brand-accent">
                    {Array.from({ length: 5 }).map((_, i) => <Icons.Star key={`star-${livestock.id}-${i}`} className="w-4 h-4 fill-current" />)}
                    <span className="text-xs font-bold ml-2">5.0 优质品种</span>
                  </div>
                </div>
                <p className="text-slate-500 leading-relaxed mb-10">{livestock.description}</p>
                <div className="space-y-6 pt-8 border-t border-slate-50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.ShieldCheck className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">领养编号</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-400">支付后生成</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.Package className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">订单编号</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-400">支付后生成</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Icons.Calendar className="w-4 h-4" /></div>
                      <span className="text-sm text-slate-500">月饲养费</span>
                    </div>
                    <span className="text-sm font-bold text-brand-primary">¥{livestock.monthlyFeedFee}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部固定支付栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            {/* 移动端布局 */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                    <Icons.Check className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500">同意<button type="button" onClick={handleShowAgreement} className="text-brand-primary cursor-pointer font-bold">《领养协议》</button></span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-brand-primary">¥</span>
                  <span className="text-2xl font-display font-bold text-brand-primary">{livestock.price}</span>
                </div>
              </div>
              <button onClick={handleConfirm} disabled={!agreed || creatingOrder} className={cn("w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all", agreed && !creatingOrder ? "bg-brand-primary text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>
                {creatingOrder ? '处理中...' : '确认领养'}
              </button>
            </div>

            {/* 桌面端布局 */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setAgreed(!agreed)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", agreed ? "bg-brand-primary border-brand-primary text-white" : "border-slate-300 text-transparent")}>
                  <Icons.Check className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm text-slate-500">我已阅读并同意 <button type="button" onClick={handleShowAgreement} className="text-brand-primary cursor-pointer font-bold hover:underline">《云端牧场领养协议》</button></span>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">应付总额</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-brand-primary">¥</span>
                    <span className="text-3xl font-display font-bold text-brand-primary">{livestock.price}</span>
                  </div>
                </div>
                <button onClick={handleConfirm} disabled={!agreed || creatingOrder} className={cn("h-12 px-10 rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all", agreed && !creatingOrder ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>
                  {creatingOrder ? '处理中...' : '确认领养'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 协议弹窗 */}
        <Modal open={showAgreement} onClose={() => setShowAgreement(false)} title={agreementContent?.title || '领养协议'}>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {loadingAgreement ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                {agreementContent?.content}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

export default DetailsPage;
