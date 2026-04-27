// ==================== 站点配置 ====================

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit, isAdminRequest: boolean = false): Promise<T> {
  const REQUEST_TIMEOUT = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const token = isAdminRequest
    ? sessionStorage.getItem('admin_token')
    : sessionStorage.getItem('token');

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

export const siteConfigApi = {
  // 获取站点配置（公开接口）
  get: async (): Promise<{
    site_name: string;
    site_title: string;
    site_description: string;
    site_keywords: string;
    contact_phone: string;
    contact_email: string;
  }> => {
    return request('/users/site-config');
  },

  // 获取支付配置（哪些支付方式启用）
  getPaymentConfig: async (): Promise<{
    alipay_enabled: boolean;
    wechat_enabled: boolean;
  }> => {
    return request('/users/payment-config');
  }
};