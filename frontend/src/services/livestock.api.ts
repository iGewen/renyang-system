import type { Livestock, LivestockType, PaginatedResponse } from '../types';

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

export const livestockApi = {
  // 获取活体类型列表
  getTypes: async (): Promise<LivestockType[]> => {
    return request('/livestock/types');
  },

  // 获取活体列表
  getList: async (params?: { typeId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    const query = new URLSearchParams();
    if (params?.typeId) query.set('typeId', params.typeId);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/livestock?${query.toString()}`);
  },

  // 获取活体详情
  getById: async (id: string): Promise<Livestock> => {
    return request(`/livestock/${id}`);
  }
};
