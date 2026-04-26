import type { PaymentResult } from '../types';

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
      throw new Error(data.message || '请求失败');
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

export const paymentApi = {
  // 发起支付
  create: async (data: { orderType: 'adoption' | 'feed' | 'redemption' | 'recharge'; orderId: string; paymentMethod: 'alipay' | 'wechat' | 'balance'; amount?: number }): Promise<PaymentResult> => {
    return request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 查询支付状态
  getStatus: async (paymentNo: string): Promise<{ status: number; paidAt?: string }> => {
    return request(`/payments/${paymentNo}`);
  }
};