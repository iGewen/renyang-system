/**
 * GrowthRecordsPage.tsx - 成长档案页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Badge, EmptyState, LoadingSpinner, Button } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { adoptionApi } from '../../services/api';
import type { Adoption } from '../../types';
import { getAdoptionStatusText, getAdoptionBadgeVariant } from '../../utils/statusConfig';

const GrowthRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      navigate('/auth');
      return;
    }

    const fetchAdoptions = async () => {
      try {
        const data = await adoptionApi.getMyAdoptions();
        setAdoptions(data || []);
      } catch (error) {
        console.error('Failed to fetch adoptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdoptions();
  }, [token, isAuthenticated, navigate]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-brand-bg pb-8">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
            <div className="flex items-center px-6 py-4">
              <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Icons.ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-slate-900 ml-4">成长档案</h1>
            </div>
          </div>
          <div className="p-6">
            <LoadingSpinner />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 ml-4">成长档案</h1>
          </div>
        </div>

        <div className="p-6">
          {adoptions.length === 0 ? (
            <EmptyState
              icon={<Icons.BookOpen className="w-12 h-12" />}
              title="暂无成长档案"
              description="领养活体后即可查看成长档案"
              action={
                <Button variant="outline" onClick={() => navigate('/')}>
                  去领养
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {adoptions.map((adoption) => {
                const livestock = adoption.livestockSnapshot as any;
                const startDate = new Date(adoption.startDate);
                const now = new Date();
                const days = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <motion.div
                    key={adoption.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/adoption/${adoption.id}`)}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {/* 卡片头部 */}
                    <div className="flex gap-4 p-4 border-b border-slate-50">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          src={livestock?.mainImage || '/placeholder.jpg'}
                          alt={livestock?.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{livestock?.name || '未知活体'}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">{adoption.adoptionNo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={getAdoptionBadgeVariant(adoption.status)}>
                            {getAdoptionStatusText(adoption.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* 时间线 */}
                    <div className="p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-500">领养时间线</span>
                        <span className="text-sm font-bold text-brand-primary">已领养 {days} 天</span>
                      </div>

                      {/* 进度条 */}
                      <div className="relative">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-primary to-indigo-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (adoption.feedMonthsPaid / (adoption.redemptionMonths - 1)) * 100)}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400">
                          <span>已缴 {adoption.feedMonthsPaid} 月</span>
                          <span>买断需 {adoption.redemptionMonths - 1} 月</span>
                        </div>
                      </div>
                    </div>

                    {/* 重要事件 */}
                    <div className="p-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Icons.Calendar className="w-4 h-4" />
                        <span>领养日期：{startDate.toLocaleDateString('zh-CN')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                        <Icons.Coins className="w-4 h-4" />
                        <span>月饲料费：¥{livestock?.monthlyFeedFee || 0}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default GrowthRecordsPage;