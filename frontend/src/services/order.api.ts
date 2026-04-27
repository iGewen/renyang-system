import type { AdoptionOrder, PaginatedResponse } from '../types';

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

export const orderApi = {
  // 创建领养订单
  // 后端返回完整的 Order 对象
  create: async (data: { livestockId: string; quantity?: number; clientOrderId: string }): Promise<{ id: string; orderNo: string; expireAt: string; [key: string]: any }> => {
    return request('/orders/adoption', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 取消订单
  cancel: async (orderId: string): Promise<{ success: boolean }> => {
    return request(`/orders/adoption/${orderId}/cancel`, { method: 'POST' });
  },

  // 获取订单详情
  getById: async (orderId: string): Promise<AdoptionOrder> => {
    return request(`/orders/adoption/${orderId}`);
  },

  // 获取我的订单列表
  getMyOrders: async (params?: { status?: number; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status !== undefined) query.set('status', params.status.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/orders/adoption?${query.toString()}`);
  }
};
