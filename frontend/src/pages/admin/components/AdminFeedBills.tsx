import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Badge, Card, Button, Modal, Input, useToast, EmptyState } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { FeedBill } from '../../../types';
import { FeedBillStatus } from '../../../types/enums';
import type { StatusVariant } from './admin-utils';

export const AdminFeedBills: React.FC = () => {
  const toast = useToast();
  const [bills, setBills] = useState<FeedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 操作相关
  const [selectedBill, setSelectedBill] = useState<FeedBill | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showWaive, setShowWaive] = useState(false);
  const [showWaiveLateFee, setShowWaiveLateFee] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchBills = async (keyword?: string) => {
    setLoading(true);
    try {
      const res = await adminApi.getFeedBills({
        status: statusFilter || undefined,
        billNo: keyword || searchKeyword || undefined,
      });
      setBills(res.list || []);
    } catch (error) {
      console.error('Failed to fetch feed bills:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBills(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  const feedBillStatusMap: Record<number, { label: string; variant: StatusVariant }> = {
    [FeedBillStatus.PENDING]: { label: '待支付', variant: 'warning' },
    [FeedBillStatus.PAID]: { label: '已支付', variant: 'success' },
    [FeedBillStatus.OVERDUE]: { label: '已逾期', variant: 'danger' },
    [FeedBillStatus.WAIVED]: { label: '已豁免', variant: 'default' },
  };

  // 调整金额
  const handleAdjust = async () => {
    if (!selectedBill) return;
    const amount = Number.parseFloat(adjustAmount);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('请输入有效金额');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('请输入调整原因');
      return;
    }
    setProcessing(true);
    try {
      await adminApi.adjustFeedBill(selectedBill.id, { adjustedAmount: amount, reason: adjustReason });
      toast.success('调整成功');
      setShowAdjust(false);
      setAdjustAmount('');
      setAdjustReason('');
      fetchBills();
    } catch (error: any) {
      toast.error(error.message || '调整失败');
    } finally {
      setProcessing(false);
    }
  };

  // 免除账单
  const handleWaive = async () => {
    if (!selectedBill) return;
    if (!waiveReason.trim()) {
      toast.error('请输入豁免原因');
      return;
    }
    setProcessing(true);
    try {
      await adminApi.waiveFeedBill(selectedBill.id, waiveReason);
      toast.success('豁免成功');
      setShowWaive(false);
      setWaiveReason('');
      fetchBills();
    } catch (error: any) {
      toast.error(error.message || '豁免失败');
    } finally {
      setProcessing(false);
    }
  };

  // 免除滞纳金
  const handleWaiveLateFee = async () => {
    if (!selectedBill) return;
    if (!waiveReason.trim()) {
      toast.error('请输入豁免原因');
      return;
    }
    setProcessing(true);
    try {
      await adminApi.waiveLateFee(selectedBill.id, waiveReason);
      toast.success('免除滞纳金成功');
      setShowWaiveLateFee(false);
      setWaiveReason('');
      fetchBills();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">饲料费管理</h2>
          <span className="text-sm text-slate-400">共 {bills.length} 条记录</span>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索账单号/用户"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <div className="flex gap-2">
            {[0, FeedBillStatus.PENDING, FeedBillStatus.PAID, FeedBillStatus.OVERDUE].map(status => {
              const filterValue = status === 0 ? '' : String(status);
              const isActive = statusFilter === filterValue;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(filterValue)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {status === 0 ? '全部' : feedBillStatusMap[status]?.label || '未知'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">账单号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">账单月份</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">滞纳金</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">账单日期</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-mono text-sm">{bill.billNo}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm text-slate-900">{bill.user?.nickname || '-'}</p>
                      <p className="text-xs text-slate-400">{bill.user?.phone || '-'}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{bill.billMonth}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">¥{bill.adjustedAmount || bill.originalAmount}</p>
                      {bill.adjustedAmount && bill.adjustedAmount !== bill.originalAmount && (
                        <p className="text-xs text-slate-400 line-through">¥{bill.originalAmount}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {bill.lateFeeAmount > 0 ? (
                      <span className="text-red-600">¥{bill.lateFeeAmount}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={feedBillStatusMap[bill.status]?.variant || 'default'}>
                      {feedBillStatusMap[bill.status]?.label || bill.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {bill.status === FeedBillStatus.PENDING || bill.status === FeedBillStatus.OVERDUE ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedBill(bill);
                            setAdjustAmount(String(bill.adjustedAmount || bill.originalAmount));
                            setShowAdjust(true);
                          }}
                        >
                          调整
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedBill(bill);
                            setShowWaive(true);
                          }}
                        >
                          豁免
                        </Button>
                        {bill.lateFeeAmount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBill(bill);
                              setShowWaiveLateFee(true);
                            }}
                          >
                            免滞纳金
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && <EmptyState icon={<Icons.Coins className="w-12 h-12" />} title="暂无饲料费账单" />}
        </div>
      </Card>

      {/* 调整金额弹窗 */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="调整金额">
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-2">原金额：¥{selectedBill?.originalAmount}</p>
            <Input
              label="调整后金额"
              type="number"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              placeholder="请输入调整后金额"
            />
          </div>
          <Input
            label="调整原因"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            placeholder="请输入调整原因"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdjust(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleAdjust} loading={processing}>
              确认调整
            </Button>
          </div>
        </div>
      </Modal>

      {/* 豁免账单弹窗 */}
      <Modal open={showWaive} onClose={() => setShowWaive(false)} title="豁免账单">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            确定要豁免该账单吗？豁免后账单状态将变更为"已豁免"，用户无需支付。
          </p>
          <Input
            label="豁免原因"
            value={waiveReason}
            onChange={e => setWaiveReason(e.target.value)}
            placeholder="请输入豁免原因"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowWaive(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleWaive} loading={processing}>
              确认豁免
            </Button>
          </div>
        </div>
      </Modal>

      {/* 免除滞纳金弹窗 */}
      <Modal open={showWaiveLateFee} onClose={() => setShowWaiveLateFee(false)} title="免除滞纳金">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            确定要免除滞纳金 ¥{selectedBill?.lateFeeAmount || 0} 吗？
          </p>
          <Input
            label="免除原因"
            value={waiveReason}
            onChange={e => setWaiveReason(e.target.value)}
            placeholder="请输入免除原因"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowWaiveLateFee(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleWaiveLateFee} loading={processing}>
              确认免除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};