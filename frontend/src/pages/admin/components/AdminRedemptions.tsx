import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Badge, Card, EmptyState, useToast, Modal, Input, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import { RedemptionStatus } from '../../../types/enums';
import type { StatusVariant } from './admin-utils';

export const AdminRedemptions: React.FC = () => {
  const toast = useToast();
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    adminApi.getRedemptions({ status: statusFilter || undefined })
      .then(res => setRedemptions(res.list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const redemptionStatusMap: Record<number, { label: string; variant: StatusVariant }> = {
    [RedemptionStatus.PENDING_AUDIT]: { label: '待审核', variant: 'warning' },
    [RedemptionStatus.AUDIT_PASSED]: { label: '审核通过', variant: 'success' },
    [RedemptionStatus.AUDIT_REJECTED]: { label: '审核拒绝', variant: 'danger' },
    [RedemptionStatus.PAID]: { label: '已支付', variant: 'info' },
    [RedemptionStatus.CANCELLED]: { label: '已取消', variant: 'default' },
  };

  const redemptionTypeMap: Record<number, { label: string; color: string }> = {
    1: { label: '满期买断', color: 'text-green-600 bg-green-50' },
    2: { label: '提前买断', color: 'text-orange-600 bg-orange-50' },
  };

  const handleApprove = async (id: string) => {
    setAuditing(true);
    try {
      await adminApi.auditRedemption(id, { approved: true });
      const res = await adminApi.getRedemptions({ status: statusFilter || undefined });
      setRedemptions(res.list || []);
      toast.success('已通过审核');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setAuditing(false);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectRemark('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setAuditing(true);
    try {
      await adminApi.auditRedemption(rejectingId, { approved: false, remark: rejectRemark || undefined });
      const res = await adminApi.getRedemptions({ status: statusFilter || undefined });
      setRedemptions(res.list || []);
      toast.success('已拒绝');
      setShowRejectModal(false);
      setRejectingId(null);
      setRejectRemark('');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setAuditing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div><h2 className="text-lg font-bold text-slate-800">买断管理</h2><p className="text-sm text-slate-400 mt-0.5">共 {redemptions.length} 条买断申请</p></div>
        <div className="flex gap-2">
          {[0, RedemptionStatus.PENDING_AUDIT, RedemptionStatus.AUDIT_PASSED, RedemptionStatus.AUDIT_REJECTED, RedemptionStatus.CANCELLED].map(status => {
            const filterValue = status === 0 ? '' : String(status);
            const isActive = statusFilter === filterValue;
            const buttonText = status === 0 ? '全部' : (redemptionStatusMap[status]?.label || '未知');
            return (
              <button key={status} onClick={() => setStatusFilter(filterValue)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {buttonText}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">买断单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">领养编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户手机</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">活体名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">买断类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">申请时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map(item => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4"><span className="font-mono text-sm text-brand-primary font-medium">{item.redemptionNo}</span></td>
                  <td className="py-3 px-4"><span className="font-mono text-sm text-slate-600">{item.adoption?.adoptionNo || item.adoptionId || '-'}</span></td>
                  <td className="py-3 px-4 text-sm">{item.user?.phone || '-'}</td>
                  <td className="py-3 px-4"><span className="font-medium text-slate-800">{item.livestock?.name || '-'}</span></td>
                  <td className="py-3 px-4"><span className={cn('px-2 py-1 rounded text-xs font-medium', redemptionTypeMap[item.type]?.color || 'bg-slate-100 text-slate-600')}>{redemptionTypeMap[item.type]?.label || (item.type === 1 ? '满期' : '提前')}</span></td>
                  <td className="py-3 px-4"><span className="font-bold text-slate-900">¥{item.finalAmount || item.originalAmount || 0}</span></td>
                  <td className="py-3 px-4"><Badge variant={redemptionStatusMap[item.status]?.variant || 'default'}>{redemptionStatusMap[item.status]?.label || item.status}</Badge></td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-3 px-4">
                    {item.status === RedemptionStatus.PENDING_AUDIT && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(item.id)} disabled={auditing} className="px-3 py-1 bg-green-100 text-green-600 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50">通过</button>
                        <button onClick={() => openRejectModal(item.id)} disabled={auditing} className="px-3 py-1 bg-red-100 text-red-500 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50">拒绝</button>
                      </div>
                    )}
                    {item.status === RedemptionStatus.AUDIT_PASSED && (<span className="text-xs text-slate-400">等待用户支付</span>)}
                    {item.status === RedemptionStatus.AUDIT_REJECTED && item.auditRemark && (<span className="text-xs text-red-400" title={item.auditRemark}>拒绝原因</span>)}
                    {item.status === RedemptionStatus.CANCELLED && (<span className="text-xs text-slate-400">已取消（超时未支付）</span>)}
                    {item.status === RedemptionStatus.PAID && (<span className="text-xs text-green-500">已完成</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {redemptions.length === 0 && (<EmptyState variant="compact" icon={<Icons.CheckCircle2 className="w-10 h-10" />} title="暂无买断申请" description="买断申请将在这里显示" />)}
        </div>
      </Card>

      {/* 拒绝备注弹窗 */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="拒绝买断申请"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">拒绝原因（可选）</label>
            <Input
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="请输入拒绝原因"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>取消</Button>
            <Button variant="danger" onClick={handleReject} loading={auditing}>确认拒绝</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
