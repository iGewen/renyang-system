import type { Livestock, LivestockType, PaginatedResponse } from '../types';
import { userRequest } from './request';

export const livestockApi = {
  // 获取活体类型列表
  getTypes: async (): Promise<LivestockType[]> => {
    return userRequest('/livestock/types');
  },

  // 获取活体列表
  getList: async (params?: { typeId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    const query = new URLSearchParams();
    if (params?.typeId) query.set('typeId', params.typeId);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return userRequest(`/livestock?${query.toString()}`);
  },

  // 获取活体详情
  getById: async (id: string): Promise<Livestock | null> => {
    try {
      return userRequest(`/livestock/${id}`);
    } catch (error: any) {
      if (error.message?.includes('不存在')) {
        return null;
      }
      throw error;
    }
  }
};