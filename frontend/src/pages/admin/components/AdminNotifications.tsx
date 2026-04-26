import React, { useState, useEffect } from 'react';
import { Icons, LoadingSpinner, Button, Card, Modal, Input, EmptyState, useToast } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { adminApi } from '../../../services/api';
import type { Notification } from '../../../types';

export const AdminNotifications: React.FC = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'system',
    userIds: '' as string,
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await adminApi.getNotifications({});
      setNotifications(res.list || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!formData.title || !formData.content) {
      toast.warning('请填写标题和内容');
      return;
    }

    setSending(true);
    try {
      await adminApi.sendNotification({
        title: formData.title,
        content: formData.content,
        type: formData.type,
        userIds: formData.userIds ? formData.userIds.split(',').map(s => s.trim()) : undefined,
      });
      toast.success('发送成功');
      setShowSendModal(false);
      setFormData({ title: '', content: '', type: 'system', userIds: '' });
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const typeMap: Record<string, { label: string; color: string }> = {
    system: { label: '系统', color: 'bg-purple-100 text-purple-600' },
    order: { label: '订单', color: 'bg-blue-100 text-blue-600' },
    feed: { label: '饲料费', color: 'bg-orange-100 text-orange-600' },
    redemption: { label: '买断', color: 'bg-green-100 text-green-600' },
    balance: { label: '余额', color: 'bg-cyan-100 text-cyan-600' },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-end items-center mb-6">
        <Button onClick={() => setShowSendModal(true)}>
          <Icons.Send className="w-4 h-4 mr-2" />
          发送通知
        </Button>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">标题</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">内容</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">接收用户</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(notification => (
                <tr key={notification.id} className="border-b border-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-500">{new Date(notification.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', typeMap[notification.type]?.color || 'bg-slate-100 text-slate-600')}>
                      {typeMap[notification.type]?.label || notification.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium">{notification.title}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 max-w-xs truncate">{notification.content}</td>
                  <td className="py-3 px-4 text-sm">{notification.userId ? '指定用户' : '全部用户'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {notifications.length === 0 && <EmptyState icon={<Icons.Bell className="w-12 h-12" />} title="暂无站内信" />}
        </div>
      </Card>

      <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title="发送站内信">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="notification-type">通知类型</label>
            <select
              id="notification-type"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="system">系统通知</option>
              <option value="order">订单通知</option>
              <option value="feed">饲料费通知</option>
              <option value="redemption">买断通知</option>
              <option value="balance">余额通知</option>
            </select>
          </div>
          <Input
            label="标题"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="请输入通知标题"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="notification-content">内容</label>
            <textarea
              id="notification-content"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
              rows={4}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="请输入通知内容"
            />
          </div>
          <Input
            label="指定用户ID（选填，多个用逗号分隔）"
            value={formData.userIds}
            onChange={e => setFormData({ ...formData, userIds: e.target.value })}
            placeholder="留空则发送给所有用户"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)}>取消</Button>
            <Button className="flex-1" onClick={handleSend} loading={sending}>发送</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
