import type { Adoption, RedemptionOrder, PaymentResult } from '../types';

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

export const redemptionApi = {
  // 获取买断预览信息（不创建订单）
  getPreview: async (adoptionId: string): Promise<{
    adoption: Adoption;
    amount: number;
    type: string;
    feedMonthsPaid: number;
    requiredMonths: number;
    remainingMonths: number;
    monthlyFeedFee: number;
  }> => {
    return request(`/redemptions/preview/${adoptionId}`);
  },

  // 获取我的买断列表
  getMyRedemptions: async (status?: number): Promise<RedemptionOrder[]> => {
    const query = status === undefined ? '' : `?status=${status}`;
    return request(`/redemptions${query}`);
  },

  // 获取买断详情
  getById: async (redemptionId: string): Promise<RedemptionOrder> => {
    return request(`/redemptions/${redemptionId}`);
  },

  // 支付买断
  pay: async (redemptionId: string, paymentMethod: 'alipay' | 'wechat' | 'balance'): Promise<PaymentResult> => {
    return request(`/redemptions/${redemptionId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  }
};
