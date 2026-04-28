/**
 * 统一请求处理模块
 * 处理401认证失败、超时、网络错误等
 */

const API_BASE = '/api';

export async function userRequest<T>(url: string, options?: RequestInit): Promise<T> {
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
      // 处理401认证失败
      if (response.status === 401) {
        const isAuthPage = globalThis.location?.pathname === '/auth';
        if (!isAuthPage) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          globalThis.dispatchEvent(new CustomEvent('auth:user-expired'));
        }
      }
      throw new Error(data?.message || `请求失败 (${response.status})`);
    }

    return data?.data || data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    if (error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 公开API请求（不需要token，不需要401处理）
export async function publicRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const REQUEST_TIMEOUT = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
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

    return data?.data || data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}