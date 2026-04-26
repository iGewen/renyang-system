import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Badge, Card, Modal, Input, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import { UserStatus } from '../../../types/enums';
import type { User } from '../../../types';
import type { StatusVariant, DetailTab } from './admin-utils';
import { useDebounce, getOrderBadgeVariant, getOrderStatusText, getPaymentBadgeVariant, getPaymentStatusText, getPaymentMethodText, getAdoptionStatusText, getAdoptionBadgeVariant } from './admin-utils';

export const AdminUsers: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  // 弹窗状态
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newStatus, setNewStatus] = useState<number>(1);
  const [editForm, setEditForm] = useState({ nickname: '', phone: '' });
  const [balanceForm, setBalanceForm] = useState({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // 用户详情数据
  const [detailTab, setDetailTab] = useState<DetailTab>('orders');
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [detailPayments, setDetailPayments] = useState<any[]>([]);
  const [detailBalanceLogs, setDetailBalanceLogs] = useState<any[]>([]);
  const [detailAdoptions, setDetailAdoptions] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPagination, setDetailPagination] = useState({ page: 1, totalPages: 1 });

  // 搜索防抖
  const debouncedKeyword = useDebounce(keyword, 500);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({ keyword: debouncedKeyword || undefined });
      setUsers(res.list || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [debouncedKeyword]);

  // 用户状态映射 - 使用数字枚举
  const userStatusMap: Record<number, { label: string; variant: StatusVariant }> = {
    [UserStatus.NORMAL]: { label: '正常', variant: 'success' },
    [UserStatus.RESTRICTED]: { label: '受限', variant: 'warning' },
    [UserStatus.BANNED]: { label: '封禁', variant: 'danger' },
  };

  const handleStatusChange = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await adminApi.updateUserStatus(selectedUser.id, newStatus);
      toast.success('状态更新成功');
      setShowStatusModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await adminApi.updateUserInfo(selectedUser.id, editForm);
      toast.success('用户信息更新成功');
      setShowEditModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 余额调整限制
  const BALANCE_ADJUST_MIN = -10000; // 最大扣减金额
  const BALANCE_ADJUST_MAX = 10000;  // 最大增加金额

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    const amount = Number.parseFloat(balanceForm.amount);
    if (Number.isNaN(amount) || amount === 0) {
      toast.error('请输入有效的金额');
      return;
    }
    // 金额限制检查
    if (amount < BALANCE_ADJUST_MIN) {
      toast.error(`单次扣减金额不能超过 ¥${Math.abs(BALANCE_ADJUST_MIN).toLocaleString()}`);
      return;
    }
    if (amount > BALANCE_ADJUST_MAX) {
      toast.error(`单次增加金额不能超过 ¥${BALANCE_ADJUST_MAX.toLocaleString()}`);
      return;
    }
    // 检查扣减后余额是否为负
    const currentBalance = typeof selectedUser.balance === 'number'
      ? selectedUser.balance
      : Number.parseFloat(selectedUser.balance || '0');
    if (currentBalance + amount < 0) {
      toast.error('扣减后余额不能为负数');
      return;
    }
    if (!balanceForm.reason.trim()) {
      toast.error('请填写调整原因');
      return;
    }
    if (balanceForm.reason.trim().length < 5) {
      toast.error('调整原因至少需要5个字符');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.adjustUserBalance(selectedUser.id, amount, balanceForm.reason);
      toast.success('余额调整成功');
      setShowBalanceModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusModal = (user: User) => {
    setSelectedUser(user);
    setNewStatus(user.status);
    setShowStatusModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({ nickname: user.nickname || '', phone: user.phone });
    setShowEditModal(true);
  };

  const openBalanceModal = (user: User) => {
    setSelectedUser(user);
    setBalanceForm({ amount: '', reason: '' });
    setShowBalanceModal(true);
  };

  // 打开用户详情弹窗
  const openDetailModal = async (user: User) => {
    setSelectedUser(user);
    setDetailTab('orders');
    setDetailPagination({ page: 1, totalPages: 1 });
    setShowDetailModal(true);
    await loadUserDetails(user.id, 'orders', 1);
  };

  // 加载用户详情数据
  const loadUserDetails = async (userId: string, tab: DetailTab, page: number = 1) => {
    setDetailLoading(true);
    try {
      if (tab === 'orders') {
        const res = await adminApi.getUserOrders(userId, page, 10);
        setDetailOrders(res.list || []);
        setDetailPagination({ page, totalPages: res.totalPages || 1 });
      } else if (tab === 'payments') {
        const res = await adminApi.getUserPayments(userId, page, 10);
        setDetailPayments(res.list || []);
        setDetailPagination({ page, totalPages: res.totalPages || 1 });
      } else if (tab === 'balance') {
        const res = await adminApi.getUserBalanceLogs(userId, page, 10);
        setDetailBalanceLogs(res.list || []);
        setDetailPagination({ page, totalPages: res.totalPages || 1 });
      } else if (tab === 'adoptions') {
        const res = await adminApi.getUserAdoptions(userId);
        setDetailAdoptions(res || []);
        setDetailPagination({ page: 1, totalPages: 1 });
      }
    } catch (error) {
      console.error('Failed to load user details:', error);
      toast.error('加载用户详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 切换详情标签
  const handleDetailTabChange = (tab: DetailTab) => {
    setDetailTab(tab);
    if (selectedUser) {
      loadUserDetails(selectedUser.id, tab, 1);
    }
  };

  // 详情分页
  const handleDetailPageChange = (page: number) => {
    if (selectedUser) {
      loadUserDetails(selectedUser.id, detailTab, page);
    }
  };

  if (loading) return <LoadingSpinner />;

  // 导出用户数据
  const handleExportUsers = async () => {
    try {
      toast.info('正在导出用户数据...');
      const result = await adminApi.exportUsers();
      // 下载文件
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
      link.download = result.filename;
      link.click();
      toast.success('导出成功');
    } catch (error: any) {
      toast.error(error.message || '导出失败');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Button size="sm" onClick={handleExportUsers} icon={<Icons.Download className="w-4 h-4" />}>
          导出Excel
        </Button>
        <Input placeholder="搜索用户（手机号/昵称）" value={keyword} onChange={e => setKeyword(e.target.value)} icon={<Icons.Search className="w-5 h-5" />} className="w-64" />
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">手机号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">昵称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">余额</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">注册时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{user.id?.substring(0, 8)}</td>
                  <td className="py-3 px-4">{user.phone}</td>
                  <td className="py-3 px-4">{user.nickname || '-'}</td>
                  <td className="py-3 px-4 font-medium">¥{typeof user.balance === 'number' ? user.balance.toFixed(2) : Number.parseFloat(user.balance || '0').toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <Badge variant={userStatusMap[user.status]?.variant || 'default'}>{userStatusMap[user.status]?.label || user.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => openDetailModal(user)} className="text-purple-600 text-sm hover:underline">详情</button>
                      <button onClick={() => openStatusModal(user)} className="text-blue-600 text-sm hover:underline">状态</button>
                      <button onClick={() => openEditModal(user)} className="text-brand-primary text-sm hover:underline">编辑</button>
                      <button onClick={() => openBalanceModal(user)} className="text-green-600 text-sm hover:underline">调余额</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState icon={<Icons.Users className="w-12 h-12" />} title="暂无用户数据" />}
        </div>
      </Card>

      {/* 状态修改弹窗 */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="修改用户状态">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">用户：{selectedUser?.phone} ({selectedUser?.nickname || '未设置昵称'})</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="user-status">选择状态</label>
            <select
              id="user-status"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={newStatus}
              onChange={e => setNewStatus(Number(e.target.value))}
            >
              <option value={1}>正常</option>
              <option value={2}>受限</option>
              <option value={3}>封禁</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleStatusChange} loading={submitting}>确认</Button>
          </div>
        </div>
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="编辑用户信息">
        <div className="p-6 space-y-4">
          <Input
            label="手机号"
            value={editForm.phone}
            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
            placeholder="请输入手机号"
          />
          <Input
            label="昵称"
            value={editForm.nickname}
            onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
            placeholder="请输入昵称"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleEditUser} loading={submitting}>保存</Button>
          </div>
        </div>
      </Modal>

      {/* 调整余额弹窗 */}
      <Modal open={showBalanceModal} onClose={() => setShowBalanceModal(false)} title="调整用户余额">
        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500">当前余额</p>
            <p className="text-2xl font-bold text-brand-primary">
              ¥{typeof selectedUser?.balance === 'number' ? selectedUser.balance.toFixed(2) : Number.parseFloat(selectedUser?.balance || '0').toFixed(2)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="balance-amount">调整金额</label>
            <input
              id="balance-amount"
              type="number"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={balanceForm.amount}
              onChange={e => setBalanceForm({ ...balanceForm, amount: e.target.value })}
              placeholder="正数为增加，负数为扣减"
            />
            <p className="text-xs text-slate-400 mt-1">
              单次限额：增加 ¥10,000 / 扣减 ¥10,000
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="balance-reason">调整原因 <span className="text-red-500">*</span></label>
            <textarea
              id="balance-reason"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
              rows={3}
              value={balanceForm.reason}
              onChange={e => setBalanceForm({ ...balanceForm, reason: e.target.value })}
              placeholder="请输入调整原因（至少5个字符）"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowBalanceModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleAdjustBalance} loading={submitting}>确认调整</Button>
          </div>
        </div>
      </Modal>

      {/* 用户详情弹窗 */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={`用户详情 - ${selectedUser?.phone || ''}`}>
        <div className="p-6">
          {/* 用户基本信息 */}
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
              <Icons.User className="w-8 h-8 text-brand-primary" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-slate-900">{selectedUser?.nickname || '未设置昵称'}</p>
              <p className="text-sm text-slate-500">{selectedUser?.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">账户余额</p>
              <p className="text-xl font-bold text-brand-primary">¥{typeof selectedUser?.balance === 'number' ? selectedUser.balance.toFixed(2) : Number.parseFloat(selectedUser?.balance || '0').toFixed(2)}</p>
            </div>
          </div>

          {/* 标签页 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleDetailTabChange('orders')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                detailTab === 'orders' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              订单记录
            </button>
            <button
              onClick={() => handleDetailTabChange('payments')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                detailTab === 'payments' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              支付记录
            </button>
            <button
              onClick={() => handleDetailTabChange('balance')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                detailTab === 'balance' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              余额明细
            </button>
            <button
              onClick={() => handleDetailTabChange('adoptions')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                detailTab === 'adoptions' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              领养详情
            </button>
          </div>

          {/* 内容区域 */}
          <div className="min-h-[300px] max-h-[400px] overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                {/* 订单记录 */}
                {detailTab === 'orders' && (
                  <div>
                    {detailOrders.length > 0 ? (
                      <div className="space-y-3">
                        {detailOrders.map((order: any) => (
                          <div key={order.id} className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-slate-900">{order.livestock?.name || '活体'}</p>
                                <p className="text-xs text-slate-400 font-mono">{order.orderNo}</p>
                              </div>
                              <Badge variant={getOrderBadgeVariant(order.status)}>
                                {getOrderStatusText(order.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">金额：¥{order.totalAmount}</span>
                              <span className="text-slate-400">{new Date(order.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<Icons.ShoppingCart className="w-10 h-10" />} title="暂无订单记录" />
                    )}
                  </div>
                )}

                {/* 支付记录 */}
                {detailTab === 'payments' && (
                  <div>
                    {detailPayments.length > 0 ? (
                      <div className="space-y-3">
                        {detailPayments.map((payment: any) => (
                          <div key={payment.id} className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-slate-900">
                                  {getPaymentMethodText(payment.paymentMethod)}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">{payment.paymentNo}</p>
                              </div>
                              <Badge variant={getPaymentBadgeVariant(payment.status)}>
                                {getPaymentStatusText(payment.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">金额：¥{payment.amount}</span>
                              <span className="text-slate-400">{new Date(payment.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<Icons.CreditCard className="w-10 h-10" />} title="暂无支付记录" />
                    )}
                  </div>
                )}

                {/* 余额明细 */}
                {detailTab === 'balance' && (
                  <div>
                    {detailBalanceLogs.length > 0 ? (
                      <div className="space-y-3">
                        {detailBalanceLogs.map((log: any) => (
                          <div key={log.id} className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-medium text-slate-900">{log.remark || log.type}</p>
                              <span className={cn(
                                'font-bold',
                                Number(log.amount) > 0 ? 'text-green-600' : 'text-red-600'
                              )}>
                                {Number(log.amount) > 0 ? '+' : ''}{Number(log.amount).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">余额：¥{log.balanceAfter || log.afterBalance || '0.00'}</span>
                              <span className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<Icons.Coins className="w-10 h-10" />} title="暂无余额明细" />
                    )}
                  </div>
                )}

                {/* 领养详情 */}
                {detailTab === 'adoptions' && (
                  <div>
                    {detailAdoptions.length > 0 ? (
                      <div className="space-y-3">
                        {detailAdoptions.map((adoption: any) => (
                          <div key={adoption.id} className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-slate-900">{adoption.livestockSnapshot?.name || adoption.livestock?.name || '活体'}</p>
                                <p className="text-xs text-slate-400 font-mono">{adoption.adoptionNo}</p>
                              </div>
                              <Badge variant={getAdoptionBadgeVariant(adoption.status)}>
                                {getAdoptionStatusText(adoption.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">已领养：{adoption.days || 0} 天</span>
                              <span className="text-slate-400">{new Date(adoption.startDate).toLocaleDateString()} 开始</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<Icons.Package className="w-10 h-10" />} title="暂无领养记录" />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 分页 */}
          {detailPagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleDetailPageChange(detailPagination.page - 1)}
                disabled={detailPagination.page <= 1}
                className="px-3 py-1 text-sm rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
              >
                上一页
              </button>
              <span className="text-sm text-slate-500">
                {detailPagination.page} / {detailPagination.totalPages}
              </span>
              <button
                onClick={() => handleDetailPageChange(detailPagination.page + 1)}
                disabled={detailPagination.page >= detailPagination.totalPages}
                className="px-3 py-1 text-sm rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
