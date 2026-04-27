import type { BalanceLog, PaymentResult, PaginatedResponse } from '../types';

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

export const balanceApi = {
  // 获取余额
  get: async (): Promise<{ balance: number }> => {
    return request('/balance');
  },

  // 获取余额流水
  getLogs: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<BalanceLog>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/balance/logs?${query.toString()}`);
  },

  // 充值余额（使用专用接口，订单ID由后端生成）
  recharge: async (amount: number, paymentMethod: 'alipay' | 'wechat'): Promise<PaymentResult> => {
    return request('/payments/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod }),
    });
  }
};