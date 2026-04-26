/**
 * NotificationPage.tsx - 消息中心页面
 * 从 App.tsx 拆分出来的独立页面组件
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition, Icons, Card, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils';
import { notificationApi } from '../../services/api';

const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getList({ isRead: activeTab === 'unread' ? 0 : undefined }),
        notificationApi.getUnreadCount()
      ]);
      setNotifications(listRes.list || []);
      setUnreadCount(countRes.count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleReadAll = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleCardClick = (n: any) => {
    // 切换展开状态
    setExpandedId(prev => prev === n.id ? null : n.id);
    // 如果未读，标记为已读
    if (n.isRead === 0) {
      markAsRead(n.id);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'order') return <Icons.Package className="w-5 h-5" />;
    if (type === 'feed') return <Icons.Coins className="w-5 h-5" />;
    if (type === 'redemption') return <Icons.CheckCircle2 className="w-5 h-5" />;
    if (type === 'balance') return <Icons.Wallet className="w-5 h-5" />;
    return <Icons.Bell className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    if (type === 'order') return 'bg-blue-100 text-blue-600';
    if (type === 'feed') return 'bg-orange-100 text-orange-600';
    if (type === 'redemption') return 'bg-green-100 text-green-600';
    if (type === 'balance') return 'bg-cyan-100 text-cyan-600';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Icons.ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold text-slate-900">消息中心</h1>
            <button onClick={handleReadAll} className="text-sm text-brand-primary font-medium" disabled={unreadCount === 0}>全部已读</button>
          </div>
          <div className="flex gap-2 px-6 pb-4">
            {[
              { key: 'all', label: '全部消息' },
              { key: 'unread', label: '未读消息', count: unreadCount }
            ].map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key as any)} className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors relative', activeTab === item.key ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600')}>
                {item.label}
                {item.count !== undefined && item.count > 0 ? <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{item.count > 9 ? '9+' : item.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 mt-4">
          {notifications.length === 0 ? (
            <EmptyState icon={<Icons.MessageSquare className="w-16 h-16" />} title={activeTab === 'unread' ? '暂无未读消息' : '暂无消息'} />
          ) : (
            <div className="space-y-3">
              {notifications.map(n => {
                const isExpanded = expandedId === n.id;
                const isUnread = n.isRead === 0;
                return (
                  <Card
                    key={n.id}
                    className={cn('p-4 cursor-pointer transition-all', isUnread ? 'bg-blue-50/50 border-blue-100' : '', isExpanded ? 'ring-2 ring-brand-primary/20' : '')}
                    onClick={() => handleCardClick(n)}
                  >
                    <div className="flex gap-4">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', getTypeColor(n.type))}>
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-slate-900 truncate pr-2">{n.title}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUnread && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                            <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed" style={isExpanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {n.content}
                        </p>
                        {n.content && n.content.length > 50 && (
                          <span className="text-xs text-brand-primary mt-1 inline-block">{isExpanded ? '收起' : '展开'}</span>
                        )}
                      </div>
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

export default NotificationPage;