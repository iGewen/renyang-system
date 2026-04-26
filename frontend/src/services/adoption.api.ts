import type { Adoption, FeedBill, PaymentResult } from '../types';

const API_BASE = '/api';

type PaymentMethod = 'alipay' | 'wechat' | 'balance';

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

export const adoptionApi = {
  // 获取我的领养列表
  getMyAdoptions: async (): Promise<Adoption[]> => {
    return request('/adoptions');
  },

  // 通过订单ID获取领养记录
  getByOrderId: async (orderId: string): Promise<Adoption> => {
    return request(`/adoptions/order/${orderId}`);
  },

  // 获取领养详情
  getById: async (adoptionId: string): Promise<Adoption> => {
    return request(`/adoptions/${adoptionId}`);
  },

  // 获取饲料费账单列表
  getFeedBills: async (adoptionId: string): Promise<FeedBill[]> => {
    return request(`/adoptions/${adoptionId}/feed-bills`);
  },

  // 获取饲料费账单详情
  getFeedBillById: async (billId: string): Promise<FeedBill> => {
    return request(`/adoptions/feed-bills/${billId}`);
  },

  // 支付饲料费
  payFeedBill: async (billId: string, paymentMethod: PaymentMethod): Promise<PaymentResult> => {
    return request(`/adoptions/feed-bills/${billId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },

  // 申请买断
  applyRedemption: async (adoptionId: string): Promise<{ redemptionId: string; redemptionNo: string; amount: number; type: 'full' | 'early' }> => {
    const result = await request<{ redemption: { id: string; redemptionNo: string; finalAmount: number }; type: 'full' | 'early' }>(`/redemptions/apply/${adoptionId}`, {
      method: 'POST',
    });
    return {
      redemptionId: result.redemption.id,
      redemptionNo: result.redemption.redemptionNo,
      amount: result.redemption.finalAmount,
      type: result.type,
    };
  }
};
