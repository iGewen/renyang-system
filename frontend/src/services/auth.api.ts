import type { User } from '../types';

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

export const authApi = {
  // 发送短信验证码
  sendSmsCode: async (phone: string, type: 'register' | 'login' | 'reset_password' | 'change_phone'): Promise<{ success: boolean }> => {
    return request('/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone, type }),
    });
  },

  // 用户注册
  register: async (data: { phone: string; code: string; password: string }): Promise<{ token: string; user: User }> => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 密码登录
  loginByPassword: async (data: { phone: string; password: string }): Promise<{ token: string; user: User }> => {
    return request('/auth/login/password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 验证码登录
  loginByCode: async (data: { phone: string; code: string }): Promise<{ token: string; user: User }> => {
    return request('/auth/login/code', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取微信授权URL
  getWechatAuthUrl: async (): Promise<{ url: string }> => {
    return request('/auth/wechat/url');
  },

  // 微信授权回调
  wechatCallback: async (code: string, state: string): Promise<{ needBindPhone: boolean; tempToken?: string; token?: string; user?: User }> => {
    return request(`/auth/wechat/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  },

  // 绑定手机号
  bindPhone: async (data: { tempToken: string; phone: string; code: string }): Promise<{ token: string; user: User }> => {
    return request('/auth/wechat/bind-phone', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 重置密码
  resetPassword: async (data: { phone: string; code: string; newPassword: string }): Promise<{ success: boolean }> => {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<User> => {
    return request('/users/me');
  },

  // 更新用户信息
  updateCurrentUser: async (data: { nickname?: string; avatar?: string }): Promise<User> => {
    return request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // 修改密码
  changePassword: async (data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean }> => {
    return request('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 修改手机号
  changePhone: async (data: { newPhone: string; code: string }): Promise<{ success: boolean }> => {
    return request('/users/me/phone', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
};