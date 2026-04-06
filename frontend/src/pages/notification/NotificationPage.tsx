import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, Card, EmptyState } from '../components/ui';
import { notificationApi } from '../services/api';

interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  content: string;
  type: string;
  relatedType?: string;
  relatedId?: string;
  isRead: number | boolean;
  readAt?: string;
  createdAt: string;
}

export const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getList({ isRead: activeTab === 'unread' ? 0 : undefined }),
        notificationApi.getUnreadCount()
      ]);
      setNotifications(listRes.list || []);
      setUnreadCount(countRes.count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: 1 } : n)
      );
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

  const handleNotificationClick = (notification: NotificationItem) => {
    // 展开或收起消息
    if (expandedId === notification.id) {
      setExpandedId(null);
    } else {
      setExpandedId(notification.id);
    }
    // 如果未读，标记为已读
    const isUnread = isNotificationUnread(notification);
    if (isUnread) {
      // 异步标记已读，不阻塞UI
      notificationApi.markRead(notification.id).then(() => {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: 1 } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }).catch(error => {
        console.error('Failed to mark as read:', error);
      });
    }
  };

  const isNotificationUnread = (notification: NotificationItem) => {
    return typeof notification.isRead === 'number'
      ? notification.isRead === 0
      : notification.isRead === false;
  };

  const getTypeIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
      system: <Icons.Bell className="w-5 h-5" />,
      order: <Icons.Package className="w-5 h-5" />,
      feed: <Icons.Coins className="w-5 h-5" />,
      redemption: <Icons.CheckCircle2 className="w-5 h-5" />,
      balance: <Icons.Wallet className="w-5 h-5" />
    };
    return map[type] || <Icons.MessageSquare className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      system: 'bg-purple-100 text-purple-600',
      order: 'bg-blue-100 text-blue-600',
      feed: 'bg-orange-100 text-orange-600',
      redemption: 'bg-green-100 text-green-600',
      balance: 'bg-cyan-100 text-cyan-600'
    };
    return map[type] || 'bg-slate-100 text-slate-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Icons.Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-bg pb-8">
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">消息中心</h1>
            <button
              onClick={handleReadAll}
              className="text-sm text-brand-primary font-medium disabled:text-slate-300"
              disabled={unreadCount === 0}
            >
              全部已读
            </button>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-2 px-6 pb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'all' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              全部消息
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
                activeTab === 'unread' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              未读消息
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="px-6 mt-4">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Icons.MessageSquare className="w-16 h-16" />}
              title={activeTab === 'unread' ? '暂无未读消息' : '暂无消息'}
            />
          ) : (
            <div className="space-y-3">
              {notifications.map(notification => {
                const isUnread = isNotificationUnread(notification);
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card
                      className={`p-4 cursor-pointer transition-all ${isUnread ? 'bg-blue-50/50 border-blue-100' : ''} ${expandedId === notification.id ? 'ring-2 ring-brand-primary/20' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-slate-900 truncate">{notification.title}</h3>
                            {isUnread && (
                              <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className={`text-sm text-slate-500 mb-2 ${expandedId === notification.id ? 'whitespace-pre-wrap' : 'overflow-hidden'}`} style={expandedId === notification.id ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{notification.content}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Card>
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
