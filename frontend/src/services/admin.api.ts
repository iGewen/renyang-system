import type {
  User,
  Livestock,
  LivestockType,
  AdoptionOrder,
  Adoption,
  FeedBill,
  RedemptionOrder,
  RefundOrder,
  Notification,
  BalanceLog,
  Admin,
  DashboardStats,
  AuditLog,
  SystemConfig,
  PaginatedResponse
} from '../types';

const API_BASE = '/api';
const REQUEST_TIMEOUT = 30000;

function safeParseJwtPayload(token: string): { exp?: number; sub?: string; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = decodeURIComponent(
      atob(parts[1])
        .split('')
        .map((c) => '%' + ('00' + (c.codePointAt(0) ?? 0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

const TokenManager = {
  getAdminToken: (): string | null => {
    const adminToken = sessionStorage.getItem('admin_token');
    if (!adminToken) return null;

    const payload = safeParseJwtPayload(adminToken);
    if (!payload) {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_info');
      return null;
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_info');
      return null;
    }
    return adminToken;
  },

  setAdminToken: (token: string): void => {
    sessionStorage.setItem('admin_token', token);
  },

  clearAdminToken: (): void => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_info');
  }
};

async function request<T>(url: string, options?: RequestInit, isAdminRequest: boolean = false): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const token = isAdminRequest ? TokenManager.getAdminToken() : sessionStorage.getItem('token');
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
      if (response.status === 401) {
        const isLoginRequest = url.includes('/auth/login');
        if (isAdminRequest && !isLoginRequest) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_info');
          globalThis.dispatchEvent(new CustomEvent('auth:admin-expired'));
        }
      }
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

async function adminRequest<T>(url: string, options?: RequestInit): Promise<T> {
  return request<T>(url, options, true);
}

export const adminApi = {
  // ==================== 认证 ====================
  login: async (data: { username: string; password: string }): Promise<{ token: string; admin: Admin }> => {
    return adminRequest('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCurrentAdmin: async (): Promise<Admin> => {
    return adminRequest('/admin/auth/info');
  },

  updatePassword: async (data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean }> => {
    return adminRequest('/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 数据统计 ====================
  getDashboardStats: async (): Promise<DashboardStats> => {
    return adminRequest('/admin/dashboard/stats');
  },

  getDashboardTrend: async (type: 'revenue' | 'order' | 'user', range: 'week' | 'month' | 'year'): Promise<{ dates: string[]; values: number[] }> => {
    return adminRequest(`/admin/dashboard/trend?type=${type}&range=${range}`);
  },

  // ==================== 活体管理 ====================
  getLivestockTypes: async (): Promise<LivestockType[]> => {
    return adminRequest('/admin/livestock-types');
  },

  createLivestockType: async (data: Partial<LivestockType>): Promise<LivestockType> => {
    return adminRequest('/admin/livestock-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateLivestockType: async (id: string, data: Partial<LivestockType>): Promise<LivestockType> => {
    return adminRequest(`/admin/livestock-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteLivestockType: async (id: string): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/livestock-types/${id}`, { method: 'DELETE' });
  },

  getLivestockList: async (params?: { typeId?: string; status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    const query = new URLSearchParams();
    if (params?.typeId) query.set('typeId', params.typeId);
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/livestock?${query.toString()}`);
  },

  createLivestock: async (data: Partial<Livestock>): Promise<Livestock> => {
    return adminRequest('/admin/livestock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateLivestock: async (id: string, data: Partial<Livestock>): Promise<Livestock> => {
    return adminRequest(`/admin/livestock/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteLivestock: async (id: string): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/livestock/${id}`, { method: 'DELETE' });
  },

  updateLivestockStatus: async (id: string, status: 'on_sale' | 'off_sale'): Promise<Livestock> => {
    return adminRequest(`/admin/livestock/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  updateLivestockStock: async (id: string, stock: number, reason?: string): Promise<Livestock> => {
    return adminRequest(`/admin/livestock/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ stock, reason }),
    });
  },

  // ==================== 订单管理 ====================
  getOrders: async (params?: { status?: string; keyword?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/orders?${query.toString()}`);
  },

  getOrderById: async (id: string): Promise<AdoptionOrder> => {
    return adminRequest(`/admin/orders/${id}`);
  },

  deleteOrder: async (id: string): Promise<{ success: boolean; message: string }> => {
    return adminRequest(`/admin/orders/${id}`, {
      method: 'DELETE',
    });
  },

  // ==================== 饲料费管理 ====================
  getFeedBills: async (params?: { status?: string; billNo?: string; userPhone?: string; isOverdue?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<FeedBill>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.billNo) query.set('billNo', params.billNo);
    if (params?.userPhone) query.set('userPhone', params.userPhone);
    if (params?.isOverdue !== undefined) query.set('isOverdue', params.isOverdue.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/feed-bills?${query.toString()}`);
  },

  adjustFeedBill: async (id: string, data: { adjustedAmount: number; reason: string }): Promise<FeedBill> => {
    return adminRequest(`/admin/feed-bills/${id}/adjust`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  waiveFeedBill: async (id: string, reason: string): Promise<FeedBill> => {
    return adminRequest(`/admin/feed-bills/${id}/waive`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  waiveLateFee: async (id: string, reason: string): Promise<FeedBill> => {
    return adminRequest(`/admin/feed-bills/${id}/waive-late-fee`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  getExceptionAdoptions: async (params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Adoption>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/adoptions/exception?${query.toString()}`);
  },

  resolveException: async (id: string, data: { action: 'contact' | 'terminate' | 'continue'; remark: string }): Promise<Adoption> => {
    return adminRequest(`/admin/adoptions/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ==================== 买断管理 ====================
  getRedemptions: async (params?: { status?: string; type?: string; userPhone?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RedemptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.userPhone) query.set('userPhone', params.userPhone);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/redemptions?${query.toString()}`);
  },

  getRedemptionById: async (id: string): Promise<RedemptionOrder> => {
    return adminRequest(`/admin/redemptions/${id}`);
  },

  auditRedemption: async (id: string, data: { approved: boolean; adjustedAmount?: number; remark?: string }): Promise<RedemptionOrder> => {
    return adminRequest(`/admin/redemptions/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 退款管理 ====================
  getRefunds: async (params?: { status?: string; refundNo?: string; userPhone?: string; orderType?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RefundOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.refundNo) query.set('refundNo', params.refundNo);
    if (params?.userPhone) query.set('userPhone', params.userPhone);
    if (params?.orderType) query.set('orderType', params.orderType);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/refunds?${query.toString()}`);
  },

  getRefundById: async (id: string): Promise<RefundOrder> => {
    return adminRequest(`/admin/refunds/${id}`);
  },

  auditRefund: async (id: string, data: { approved: boolean; remark?: string }): Promise<any> => {
    return adminRequest(`/admin/refunds/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminRefund: async (data: { userId: string; amount: number; reason: string; orderType?: string; orderId?: string }): Promise<RefundOrder> => {
    return adminRequest('/admin/refunds/refund', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 用户管理 ====================
  getUsers: async (params?: { status?: string; keyword?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<User>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/users?${query.toString()}`);
  },

  getUserById: async (id: string): Promise<User> => {
    return adminRequest(`/admin/users/${id}`);
  },

  getUserAdoptions: async (id: string): Promise<Adoption[]> => {
    return adminRequest(`/admin/users/${id}/adoptions`);
  },

  getUserOrders: async (id: string, page?: number, pageSize?: number): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (page) query.set('page', page.toString());
    if (pageSize) query.set('pageSize', pageSize.toString());
    return adminRequest(`/admin/users/${id}/orders?${query.toString()}`);
  },

  getUserBalanceLogs: async (id: string, page?: number, pageSize?: number): Promise<PaginatedResponse<BalanceLog>> => {
    const query = new URLSearchParams();
    if (page) query.set('page', page.toString());
    if (pageSize) query.set('pageSize', pageSize.toString());
    return adminRequest(`/admin/users/${id}/balance-logs?${query.toString()}`);
  },

  getUserPayments: async (id: string, page?: number, pageSize?: number): Promise<PaginatedResponse<any>> => {
    const query = new URLSearchParams();
    if (page) query.set('page', page.toString());
    if (pageSize) query.set('pageSize', pageSize.toString());
    return adminRequest(`/admin/users/${id}/payments?${query.toString()}`);
  },

  updateUserStatus: async (id: string, status: number): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  updateUserInfo: async (id: string, data: { nickname?: string; phone?: string }): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  adjustUserBalance: async (id: string, amount: number, reason: string): Promise<{ success: boolean; balance: number }> => {
    return adminRequest(`/admin/users/${id}/balance`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  },

  // ==================== 消息管理 ====================
  getNotifications: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/notifications?${query.toString()}`);
  },

  sendNotification: async (data: { userIds?: string[]; title: string; content: string; type: string }): Promise<{ success: boolean; sendCount: number }> => {
    return adminRequest('/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 系统配置 ====================
  getConfigs: async (configType?: string): Promise<SystemConfig[]> => {
    const query = configType ? `?type=${configType}` : '';
    return adminRequest(`/admin/system-config${query}`);
  },

  updateConfig: async (key: string, value: any): Promise<SystemConfig> => {
    return adminRequest(`/admin/system-config`, {
      method: 'POST',
      body: JSON.stringify({ configKey: key, configValue: value }),
    });
  },

  testPayment: async (type: 'alipay' | 'wechat'): Promise<{ success: boolean; message: string }> => {
    return adminRequest(`/admin/configs/test-payment/${type}`, { method: 'POST' });
  },

  testSms: async (phone: string): Promise<{ success: boolean; message: string }> => {
    return adminRequest('/admin/configs/test-sms', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  // ==================== 管理员管理 ====================
  getAdmins: async (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Admin>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/admins?${query.toString()}`);
  },

  createAdmin: async (data: { username: string; password: string; name: string; phone?: string; role: 'super_admin' | 'admin' }): Promise<Admin> => {
    return adminRequest('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAdmin: async (id: string, data: Partial<Admin>): Promise<Admin> => {
    return adminRequest(`/admin/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  resetAdminPassword: async (id: string, newPassword: string): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/admins/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  },

  updateAdminStatus: async (id: string, status: 'enabled' | 'disabled'): Promise<Admin> => {
    return adminRequest(`/admin/admins/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // ==================== 审计日志 ====================
  getAuditLogs: async (params?: { adminId?: string; module?: string; action?: string; isSensitive?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AuditLog>> => {
    const query = new URLSearchParams();
    if (params?.adminId) query.set('adminId', params.adminId);
    if (params?.module) query.set('module', params.module);
    if (params?.action) query.set('action', params.action);
    if (params?.isSensitive !== undefined) query.set('isSensitive', params.isSensitive.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return adminRequest(`/admin/audit-logs?${query.toString()}`);
  },

  getAuditLogById: async (id: string): Promise<AuditLog> => {
    return adminRequest(`/admin/audit-logs/${id}`);
  },

  clearAuditLogs: async (): Promise<{ success: boolean }> => {
    return adminRequest('/admin/audit-logs', { method: 'DELETE' });
  },

  verifyPassword: async (password: string): Promise<{ success: boolean }> => {
    return adminRequest('/admin/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  // ==================== 协议管理 ====================
  getAgreements: async (): Promise<{ id: string; agreementKey: string; title: string; content: string; createdAt: string; updatedAt: string }[]> => {
    return adminRequest('/admin/agreements');
  },

  getAgreement: async (key: string): Promise<{ id: string; agreementKey: string; title: string; content: string; createdAt: string; updatedAt: string }> => {
    return adminRequest(`/admin/agreements/${key}`);
  },

  saveAgreement: async (data: { agreementKey: string; title: string; content: string }): Promise<{ success: boolean; id: string }> => {
    return adminRequest('/admin/agreements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteAgreement: async (key: string): Promise<{ success: boolean }> => {
    return adminRequest(`/admin/agreements/${key}`, { method: 'DELETE' });
  },

  // ==================== 数据导出 ====================
  exportUsers: async (params?: { status?: number; startDate?: string; endDate?: string }): Promise<{ base64: string; filename: string }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return adminRequest(`/admin/export/users?${query.toString()}`);
  },

  exportOrders: async (params?: { status?: number; startDate?: string; endDate?: string }): Promise<{ base64: string; filename: string }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return adminRequest(`/admin/export/orders?${query.toString()}`);
  },

  exportAdoptions: async (params?: { status?: number; startDate?: string; endDate?: string }): Promise<{ base64: string; filename: string }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return adminRequest(`/admin/export/adoptions?${query.toString()}`);
  },

  exportFeedBills: async (params?: { status?: number; startDate?: string; endDate?: string }): Promise<{ base64: string; filename: string }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status.toString());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return adminRequest(`/admin/export/feed-bills?${query.toString()}`);
  },
};
