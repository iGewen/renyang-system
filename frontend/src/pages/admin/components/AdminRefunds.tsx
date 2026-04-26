import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Card, Modal, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';

const RefundStatusMap: Record<number, { label: string; color: string }> = {
  1: { label: '待审核', color: 'text-orange-600 bg-orange-50' },
  2: { label: '审核通过', color: 'text-green-600 bg-green-50' },
  3: { label: '审核拒绝', color: 'text-red-600 bg-red-50' },
  4: { label: '已退款', color: 'text-blue-600 bg-blue-50' },
  5: { label: '已取消', color: 'text-slate-600 bg-slate-100' },
};

export const AdminRefunds: React.FC = () => {
  const toast = useToast();
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditPassed, setAuditPassed] = useState(true);
  const [auditRemark, setAuditRemark] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // 订单类型文本映射
  const getOrderTypeText = (orderType: string): string => {
    if (orderType === 'adoption') return '领养订单';
    if (orderType === 'feed') return '饲料费';
    return orderType;
  };

  // 审核按钮文本
  const getAuditButtonText = (): string => {
    if (auditLoading) return '处理中...';
    return auditPassed ? '审核通过' : '拒绝退款';
  };

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRefunds({ status: statusFilter?.toString() });
      setRefunds(res.list || []);
    } catch (error) {
      console.error('Failed to load refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
  }, [statusFilter]);

  const handleAudit = async () => {
    if (!selectedRefund) return;
    setAuditLoading(true);
    try {
      await adminApi.auditRefund(selectedRefund.id, {
        approved: auditPassed,
        remark: auditRemark,
      });

      toast.success(auditPassed ? '退款审核通过，已执行退款' : '退款申请已拒绝');
      setShowAuditModal(false);
      setSelectedRefund(null);
      setAuditRemark('');
      loadRefunds();
    } catch (error: any) {
      toast.error(error.message || '审核失败');
    } finally {
      setAuditLoading(false);
    }
  };

  const openAuditModal = (refund: any, passed: boolean) => {
    setSelectedRefund(refund);
    setAuditPassed(passed);
    setAuditRemark('');
    setShowAuditModal(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">

        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === undefined ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            全部
          </button>
          {[1, 2, 3, 4, 5].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {RefundStatusMap[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {refunds.length === 0 ? (
        <EmptyState icon={<Icons.RefreshCw className="w-16 h-16" />} title="暂无退款记录" />
      ) : (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">退款单号</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">订单类型</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">原金额</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">退款金额</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">原因</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map(refund => (
                  <tr key={refund.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-sm">{refund.refundNo}</td>
                    <td className="py-3 px-4">{refund.user?.nickname || refund.user?.phone || refund.userId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
                        {getOrderTypeText(refund.orderType)}
                      </span>
                    </td>
                    <td className="py-3 px-4">¥{refund.originalAmount}</td>
                    <td className="py-3 px-4 font-medium text-brand-primary">¥{refund.refundAmount}</td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', RefundStatusMap[refund.status]?.color || 'bg-slate-100')}>
                        {RefundStatusMap[refund.status]?.label || refund.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">{refund.reason || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{new Date(refund.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      {refund.status === 1 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openAuditModal(refund, true)}
                            className="text-green-600 hover:underline text-sm"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => openAuditModal(refund, false)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            拒绝
                          </button>
                        </div>
                      )}
                      {refund.status !== 1 && (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 审核弹窗 */}
      <Modal open={showAuditModal} onClose={() => setShowAuditModal(false)} title={auditPassed ? '审核通过退款' : '拒绝退款申请'}>
        <div className="space-y-4">
          {selectedRefund && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">退款单号</p>
              <p className="font-mono text-slate-900">{selectedRefund.refundNo}</p>
              <p className="text-sm text-slate-500 mt-2">用户</p>
              <p className="text-slate-900">{selectedRefund.user?.nickname || selectedRefund.user?.phone || selectedRefund.userId}</p>
              <p className="text-sm text-slate-500 mt-2">原金额</p>
              <p className="text-slate-900">¥{selectedRefund.originalAmount}</p>
              <p className="text-sm text-slate-500 mt-2">退款原因</p>
              <p className="text-slate-900">{selectedRefund.reason || '-'}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="audit-remark">备注</label>
            <textarea
              id="audit-remark"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
              rows={2}
              placeholder="审核备注（可选）"
              value={auditRemark}
              onChange={e => setAuditRemark(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAuditModal(false)}>
              取消
            </Button>
            <Button
              className={cn('flex-1', auditPassed ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}
              onClick={handleAudit}
              disabled={auditLoading}
            >
              {getAuditButtonText()}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
