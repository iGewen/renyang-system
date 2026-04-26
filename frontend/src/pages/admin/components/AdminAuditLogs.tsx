import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Card, Modal, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { AuditLog } from '../../../types';

// 操作类型中文映射
const actionMap: Record<string, string> = {
  login: '登录',
  logout: '登出',
  create: '创建',
  update: '更新',
  delete: '删除',
  update_status: '修改状态',
  update_config: '修改配置',
  send: '发送',
  send_announcement: '发送公告',
  approve: '审核通过',
  reject: '审核拒绝',
  adjust: '调整',
  waive: '豁免',
};

// 模块中文映射
const moduleMapFull: Record<string, { label: string; color: string }> = {
  auth: { label: '认证', color: 'bg-purple-100 text-purple-600' },
  admin: { label: '管理员', color: 'bg-purple-100 text-purple-600' },
  user: { label: '用户', color: 'bg-blue-100 text-blue-600' },
  livestock: { label: '活体', color: 'bg-green-100 text-green-600' },
  livestock_type: { label: '活体类型', color: 'bg-green-100 text-green-600' },
  order: { label: '订单', color: 'bg-orange-100 text-orange-600' },
  adoption: { label: '领养', color: 'bg-yellow-100 text-yellow-600' },
  feed_bill: { label: '饲料费', color: 'bg-cyan-100 text-cyan-600' },
  redemption: { label: '买断', color: 'bg-pink-100 text-pink-600' },
  refund: { label: '退款', color: 'bg-red-100 text-red-600' },
  notification: { label: '通知', color: 'bg-indigo-100 text-indigo-600' },
  system_config: { label: '系统配置', color: 'bg-slate-100 text-slate-600' },
  agreement: { label: '协议', color: 'bg-teal-100 text-teal-600' },
  config: { label: '配置', color: 'bg-slate-100 text-slate-600' },
};

// 格式化IP地址（转换IPv6为IPv4）
const formatIp = (ip: string | undefined): string => {
  if (!ip) return '-';
  // 处理IPv6映射的IPv4地址 (如 ::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  // 处理本地回环地址
  if (ip === '::1' || ip === '::') {
    return '127.0.0.1';
  }
  return ip;
};

// 格式化JSON显示
const formatJson = (data: any): string => {
  if (!data) return '无';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export const AdminAuditLogs: React.FC = () => {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({ module: moduleFilter || undefined });
      setLogs(res.list || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [moduleFilter]);

  const handleClearLogs = async () => {
    if (!confirmPassword.trim()) {
      setPasswordError('请输入管理员密码');
      return;
    }
    setClearing(true);
    setPasswordError('');
    try {
      // 先验证密码
      await adminApi.verifyPassword(confirmPassword);
      // 密码正确，执行清空
      await adminApi.clearAuditLogs();
      toast.success('审计日志已清空');
      setShowClearConfirm(false);
      setConfirmPassword('');
      loadLogs();
    } catch (error: any) {
      if (error.message?.includes('密码') || error.status === 401) {
        setPasswordError('密码错误');
      } else {
        toast.error(error.message || '清空失败');
      }
    } finally {
      setClearing(false);
    }
  };

  const openClearConfirm = () => {
    setConfirmPassword('');
    setPasswordError('');
    setShowClearConfirm(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-end items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModuleFilter('')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                moduleFilter === '' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              全部
            </button>
            {Object.entries(moduleMapFull).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setModuleFilter(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  moduleFilter === key ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {value.label}
              </button>
            ))}
          </div>
          <Button variant="danger" size="sm" onClick={openClearConfirm}>
            <Icons.Trash2 className="w-4 h-4" />
            <span>清空日志</span>
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作人</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">模块</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">描述</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">IP地址</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{log.adminName || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', moduleMapFull[log.module]?.color || 'bg-slate-100 text-slate-600')}>
                      {moduleMapFull[log.module]?.label || log.module}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{actionMap[log.action] || log.action}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">{log.remark || '-'}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 font-mono">{formatIp(log.ip)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-brand-primary hover:underline text-sm"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <EmptyState icon={<Icons.FileText className="w-12 h-12" />} title="暂无审计日志" />}
        </div>
      </Card>

      {/* 清空确认弹窗 - 需要密码确认 */}
      <Modal open={showClearConfirm} onClose={() => { setShowClearConfirm(false); setConfirmPassword(''); setPasswordError(''); }} title="确认清空审计日志">
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50 rounded-xl">
            <div className="flex items-start gap-3">
              <Icons.AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">危险操作警告</p>
                <p className="text-sm text-red-600 mt-1">此操作将清空所有审计日志，且无法恢复。请输入管理员密码确认操作。</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="admin-password-confirm">管理员密码</label>
            <input
              id="admin-password-confirm"
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
              placeholder="请输入管理员密码"
            />
            {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setShowClearConfirm(false); setConfirmPassword(''); }}>取消</Button>
            <Button variant="danger" className="flex-1" onClick={handleClearLogs} loading={clearing}>确认清空</Button>
          </div>
        </div>
      </Modal>

      {/* 日志详情弹窗 */}
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="操作详情">
        <div className="p-6 space-y-3">
          {selectedLog && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-sm text-slate-500">操作人</p><p className="font-medium">{selectedLog.adminName || '-'}</p></div>
                <div><p className="text-sm text-slate-500">IP地址</p><p className="font-mono text-sm">{formatIp(selectedLog.ip)}</p></div>
                <div><p className="text-sm text-slate-500">模块</p><p>{moduleMapFull[selectedLog.module]?.label || selectedLog.module}</p></div>
                <div><p className="text-sm text-slate-500">操作</p><p>{actionMap[selectedLog.action] || selectedLog.action}</p></div>
                <div className="col-span-2"><p className="text-sm text-slate-500">时间</p><p>{new Date(selectedLog.createdAt).toLocaleString()}</p></div>
                <div className="col-span-2"><p className="text-sm text-slate-500">描述</p><p>{selectedLog.remark || '-'}</p></div>
              </div>
              {(selectedLog.beforeData || selectedLog.afterData) && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">变更详情</p>
                  {selectedLog.beforeData && (
                    <div className="mb-2">
                      <p className="text-xs text-slate-400">变更前：</p>
                      <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-auto max-h-40">{formatJson(selectedLog.beforeData)}</pre>
                    </div>
                  )}
                  {selectedLog.afterData && (
                    <div>
                      <p className="text-xs text-slate-400">变更后：</p>
                      <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-auto max-h-40">{formatJson(selectedLog.afterData)}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>关闭</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
