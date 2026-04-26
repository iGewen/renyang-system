import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Badge, Card, EmptyState } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { FeedBill } from '../../../types';
import { FeedBillStatus } from '../../../types/enums';
import type { StatusVariant } from './admin-utils';

export const AdminFeedBills: React.FC = () => {
  const [bills, setBills] = useState<FeedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    adminApi.getFeedBills({ status: statusFilter || undefined })
      .then(res => setBills(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const feedBillStatusMap: Record<number, { label: string; variant: StatusVariant }> = {
    [FeedBillStatus.PENDING]: { label: '待支付', variant: 'warning' },
    [FeedBillStatus.PAID]: { label: '已支付', variant: 'success' },
    [FeedBillStatus.OVERDUE]: { label: '已逾期', variant: 'danger' },
    [FeedBillStatus.WAIVED]: { label: '已豁免', variant: 'default' },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-end items-center mb-6">
        <div className="flex gap-2">
          {[0, FeedBillStatus.PENDING, FeedBillStatus.PAID, FeedBillStatus.OVERDUE].map(status => {
            const filterValue = status === 0 ? '' : String(status);
            const isActive = statusFilter === filterValue;
            return (
              <button key={status} onClick={() => setStatusFilter(filterValue)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {status === 0 ? '全部' : feedBillStatusMap[status]?.label || '未知'}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">账单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">滞纳金</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">到期日</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{bill.billNo}</td>
                  <td className="py-3 px-4">{bill.user?.phone || '-'}</td>
                  <td className="py-3 px-4">¥{bill.adjustedAmount || bill.originalAmount}</td>
                  <td className="py-3 px-4">¥{bill.lateFeeAmount || 0}</td>
                  <td className="py-3 px-4"><Badge variant={feedBillStatusMap[bill.status]?.variant || 'default'}>{feedBillStatusMap[bill.status]?.label || bill.status}</Badge></td>
                  <td className="py-3 px-4 text-sm text-slate-500">{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && <EmptyState icon={<Icons.Coins className="w-12 h-12" />} title="暂无饲料费账单" />}
        </div>
      </Card>
    </div>
  );
};
