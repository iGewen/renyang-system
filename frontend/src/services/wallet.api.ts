import type { PaginatedResponse } from '../types';

const API_BASE = '/api';

export interface TransactionRecord {
  id: string;
  transactionNo: string;
  type: 'payment' | 'refund' | 'recharge' | 'adjust';
  typeLabel: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  status: number;
  statusLabel: string;
  createdAt: string;
  orderType?: string;
  orderId?: string;
  orderNo?: string;
  transactionId?: string;
  productName?: string;
  remark?: string;
}

export interface TransactionDetail extends TransactionRecord {
  // 支付相关
  outTradeNo?: string;
  orderNo?: string;
  adoptionNo?: string;
  feedBillNo?: string;
  redemptionNo?: string;
  refundNo?: string;
  refundReason?: string;
  refundMethod?: string;
  // 订单信息
  orderInfo?: {
    orderNo: string;
    totalAmount: number;
    status: number;
  } | null;
  adoptionInfo?: {
    adoptionNo: string;
    status: number;
  } | null;
  feedBillInfo?: {
    billNo: string;
    billMonth: string;
    amount: number;
  } | null;
  redemptionInfo?: {
    redemptionNo: string;
    finalAmount: number;
    type: number;
  } | null;
  refundInfo?: {
    refundNo: string;
    refundAmount: number;
    reason: string;
    refundAt: string;
  } | null;
  // 余额相关
  balanceBefore?: number;
  balanceAfter?: number;
}

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

export const walletApi = {
  // 获取钱包概览
  getOverview: async (): Promise<{ balance: number; user: { id: string; nickname: string; phone?: string; avatar?: string } }> => {
    return request('/wallet');
  },

  // 获取交易记录列表
  getTransactions: async (params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<TransactionRecord>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params?.type) query.set('type', params.type);
    if (params?.paymentMethod) query.set('paymentMethod', params.paymentMethod);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return request(`/wallet/transactions?${query.toString()}`);
  },

  // 获取交易详情
  getTransactionDetail: async (transactionNo: string): Promise<TransactionDetail> => {
    return request(`/wallet/transactions/${transactionNo}`);
  },
};