import type { RefundOrder, PaginatedResponse } from '../types';

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

export const refundApi = {
  // 申请退款
  apply: async (data: { orderType: 'adoption' | 'feed' | 'redemption'; orderId: string; reason: string }): Promise<{ refundId: string; refundNo: string }> => {
    return request('/refunds/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取退款详情
  getById: async (refundId: string): Promise<RefundOrder> => {
    return request(`/refunds/${refundId}`);
  },

  // 获取我的退款列表
  getMyRefunds: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RefundOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/refunds/my?${query.toString()}`);
  }
};