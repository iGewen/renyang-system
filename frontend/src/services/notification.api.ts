import type { Notification, PaginatedResponse } from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const REQUEST_TIMEOUT = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const token = sessionStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || `请求失败 (${response.status})`);
    }

    return data.data || data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const notificationApi = {
  // 获取站内信列表
  getList: async (params?: { type?: string; isRead?: number; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.isRead !== undefined) query.set('isRead', params.isRead.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/notifications?${query.toString()}`);
  },

  // 获取未读消息数量
  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await request<{ unreadCount: number; totalCount: number }>('/notifications/unread-count');
    return { count: res.unreadCount };
  },

  // 标记已读
  markRead: async (notificationId: string): Promise<{ success: boolean }> => {
    return request(`/notifications/${notificationId}/read`, { method: 'POST' });
  },

  // 标记全部已读
  markAllRead: async (): Promise<{ success: boolean }> => {
    return request('/notifications/read-all', { method: 'POST' });
  }
};