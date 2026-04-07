import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, Icons, EmptyState } from '../components/ui';
import { notificationApi } from '../services/api';

interface NotificationItem {
  id: string;
  userId?: string | null;
  title: string;
  content: string;
  type: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: number;
  readAt?: string | null;
  createdAt: string;
}

export const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
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

  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      // 更新本地状态 - 使用数字1而不是布尔值true，与后端保持一致
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (markingAllRead || unreadCount === 0) return;

    try {
      setMarkingAllRead(true);
      await notificationApi.markAllRead();
      // 更新本地状态
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleCardClick = (notification: NotificationItem) => {
    // 切换展开状态
    toggleExpand(notification.id);
    // 如果未读，标记为已读
    if (notification.isRead === 0) {
      markAsRead(notification.id);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      system: <Icons.Bell className="w-5 h-5" />,
      order: <Icons.Package className="w-5 h-5" />,
      feed: <Icons.Coins className="w-5 h-5" />,
      redemption: <Icons.CheckCircle2 className="w-5 h-5" />,
      balance: <Icons.Wallet className="w-5 h-5" />
    };
    return icons[type] || <Icons.MessageSquare className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      system: 'bg-purple-100 text-purple-600',
      order: 'bg-blue-100 text-blue-600',
      feed: 'bg-orange-100 text-orange-600',
      redemption: 'bg-green-100 text-green-600',
      balance: 'bg-cyan-100 text-cyan-600'
    };
    return colors[type] || 'bg-slate-100 text-slate-600';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">消息中心</h1>
            <button
              onClick={markAllAsRead}
              className={`text-sm font-medium transition-colors ${
                unreadCount === 0 || markingAllRead
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-brand-primary hover:text-brand-600'
              }`}
              disabled={unreadCount === 0 || markingAllRead}
            >
              {markingAllRead ? '处理中...' : '全部已读'}
            </button>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-2 px-6 pb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'all' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部消息
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
                activeTab === 'unread' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              未读消息
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
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
              icon={<Icons.MessageSquare className="w-16 h-16 text-slate-300" />}
              title={activeTab === 'unread' ? '暂无未读消息' : '暂无消息'}
              description={activeTab === 'unread' ? '所有消息都已读' : '您还没有收到任何消息'}
            />
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const isUnread = notification.isRead === 0;
                const isExpanded = expandedId === notification.id;

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`bg-white rounded-2xl shadow-sm border p-4 cursor-pointer transition-all ${
                        isUnread ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'
                      } ${isExpanded ? 'ring-2 ring-brand-primary/20' : ''}`}
                      onClick={() => handleCardClick(notification)}
                    >
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-slate-900 truncate pr-2">{notification.title}</h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isUnread && (
                                <span className="w-2 h-2 bg-red-500 rounded-full" />
                              )}
                              <span className="text-xs text-slate-400">{formatTime(notification.createdAt)}</span>
                            </div>
                          </div>
                          <p
                            className="text-sm text-slate-600 leading-relaxed"
                            style={isExpanded ? {} : {
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {notification.content}
                          </p>
                          {notification.content.length > 50 && (
                            <span className="text-xs text-brand-primary mt-1 inline-block">
                              {isExpanded ? '收起' : '展开'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
