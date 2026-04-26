/**
 * MyAdoptionsPage.tsx - 我的牧场页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageTransition, Icons, Card, Button, Badge, EmptyState, LoadingSpinner } from '../../components/ui';
import { Navbar } from '../../components/layout';
import { adoptionApi, redemptionApi } from '../../services/api';
import type { Adoption } from '../../types';
import { AdoptionStatus } from '../../types/enums';
import { getAdoptionStatusText, getAdoptionBadgeVariant } from '../../utils/statusConfig';

const MyAdoptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [adoptionsData, redemptionsData] = await Promise.all([
          adoptionApi.getMyAdoptions(),
          redemptionApi.getMyRedemptions().catch(() => [])
        ]);
        setAdoptions(adoptionsData);
        setRedemptions(redemptionsData);
      } catch (error) {
        console.error('Failed to fetch adoptions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getRedemptionForAdoption = (adoptionId: string) => {
    return redemptions.find(r => r.adoptionId === adoptionId && (r.status === 1 || r.status === 2));
  };

  type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

  const getStatusBadge = (status: number, redemption?: any) => {
    if (redemption?.status === 2) {
      return <Badge variant="info">审核通过待支付</Badge>;
    }
    const map: Record<number, { label: string; variant: BadgeVariant }> = {
      [AdoptionStatus.ACTIVE]: { label: '领养中', variant: 'success' },
      [AdoptionStatus.FEED_OVERDUE]: { label: '饲料费逾期', variant: 'danger' },
      [AdoptionStatus.EXCEPTION]: { label: '异常', variant: 'danger' },
      [AdoptionStatus.REDEEMABLE]: { label: '可买断', variant: 'info' },
      [AdoptionStatus.REDEMPTION_PENDING]: { label: '买断审核中', variant: 'warning' },
      [AdoptionStatus.REDEEMED]: { label: '已买断', variant: 'default' },
      [AdoptionStatus.TERMINATED]: { label: '已终止', variant: 'default' }
    };
    const config = map[status] || { label: getAdoptionStatusText(status), variant: getAdoptionBadgeVariant(status) };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="pb-28">
        <Navbar title="我的牧场" />
        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-brand-primary mb-2">牧场概览</h2>
            <p className="text-slate-400 text-sm">您目前有 {adoptions.length} 个活体正在茁壮成长</p>
          </div>
          {adoptions.length === 0 ? (
            <EmptyState
              icon={<Icons.Package className="w-16 h-16" />}
              title="暂无领养记录"
              description="去探索您喜欢的活体吧"
              action={
                <Link to="/" className="text-brand-primary font-bold text-sm flex items-center gap-2">
                  去探索 <Icons.ChevronRight className="w-4 h-4" />
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {adoptions.map((item) => {
                const redemption = getRedemptionForAdoption(item.id);
                const canPayRedemption = redemption?.status === 2;
                return (
                  <Card key={item.id} className="p-8" onClick={() => navigate(`/adoption/${item.id}`)}>
                    <div className="flex gap-5 mb-6">
                      <div className="w-20 h-20 rounded-[24px] overflow-hidden shadow-sm flex-shrink-0">
                        <img
                          src={item.livestockSnapshot?.mainImage || item.livestock?.mainImage}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          alt=""
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-xl font-display font-bold text-brand-primary truncate">
                            {item.livestockSnapshot?.name || item.livestock?.name}
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mb-2">ID: {item.adoptionNo}</p>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(item.status, redemption)}
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span>已领养 <b className="text-brand-primary">{item.days || 0}</b> 天</span>
                          <span>已缴 <b className="text-brand-primary">{item.feedMonthsPaid}</b> 月</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}?tab=bills`); }}
                      >
                        饲料费
                      </Button>
                      {canPayRedemption && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}`); }}
                        >
                          去支付
                        </Button>
                      )}
                      {!canPayRedemption && (item.status === AdoptionStatus.REDEEMABLE || item.status === AdoptionStatus.ACTIVE) && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/adoption/${item.id}/redemption`); }}
                        >
                          申请买断
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default MyAdoptionsPage;
