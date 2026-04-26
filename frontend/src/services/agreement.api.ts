// ==================== 协议相关 ====================

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

export const agreementApi = {
  // 获取协议内容
  get: async (type: string): Promise<{ title: string; content: string; updatedAt: string }> => {
    return request(`/users/agreements/${type}`);
  },

  // 获取协议列表
  getList: async (): Promise<{ key: string; title: string; updatedAt: string }[]> => {
    return request('/users/agreements');
  }
};