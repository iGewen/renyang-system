import type {
  User,
  Livestock,
  LivestockType,
  AdoptionOrder,
  Adoption,
  FeedBill,
  RedemptionOrder,
  RefundOrder,
  PaymentResult,
  Notification,
  BalanceLog,
  Admin,
  DashboardStats,
  AuditLog,
  SystemConfig,
  PaginatedResponse
} from '../types';

// 支付方式类型
type PaymentMethod = 'alipay' | 'wechat' | 'balance';

const API_BASE = '/api';
const REQUEST_TIMEOUT = 30000; // 30秒超时

/**
 * 安全解析 JWT payload
 * 修复 F-002：支持非ASCII字符（如中文用户名）
 */
function safeParseJwtPayload(token: string): { exp?: number; sub?: string; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      // JWT 格式不正确
      return null;
    }
    // 修复：使用 decodeURIComponent + escape 组合处理 Base64 中的非ASCII字符
    // 这是因为 atob() 只能处理 ASCII 字符，而 JWT payload 可能包含 UTF-8 编码的中文
    const payload = decodeURIComponent(
      atob(parts[1])
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(payload);
  } catch (error) {
    // 解析失败，返回 null
    console.warn('[JWT] 解析 token 失败:', error);
    return null;
  }
}

// Token 管理工具
// 安全修复 (F-C03): 使用 sessionStorage 替代 localStorage
// sessionStorage 在标签页关闭后自动清除，比 localStorage 更安全
const TokenManager = {
  get: (isAdminRequest: boolean = false): string | null => {
    // 如果是管理后台请求，优先使用 admin_token
    if (isAdminRequest) {
      const adminToken = sessionStorage.getItem('admin_token');
      if (adminToken) {
        const payload = safeParseJwtPayload(adminToken);
        if (!payload) {
          // Token 格式无效，清除
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
      }
      return null;
    }

    // 普通用户请求，使用 token
    const token = sessionStorage.getItem('token');
    if (!token) return null;

    const payload = safeParseJwtPayload(token);
    if (!payload) {
      // Token 格式无效，清除
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      return null;
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      return null;
    }
    return token;
  },

  set: (token: string, isAdmin: boolean = false): void => {
    if (isAdmin) {
      sessionStorage.setItem('admin_token', token);
    } else {
      sessionStorage.setItem('token', token);
    }
  },

  clear: (): void => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('admin_info');
  }
};

// 通用请求方法
async function request<T>(url: string, options?: RequestInit, isAdminRequest: boolean = false): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const token = TokenManager.get(isAdminRequest);
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
      // 401 错误时清除过期的 Token 并跳转到登录页
      // 但登录接口本身返回401时不跳转（用户名密码错误）
      if (response.status === 401) {
        const isLoginRequest = url.includes('/auth/login');
        if (isAdminRequest && !isLoginRequest) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_info');
          // 修复 F-003/F-004：使用 React Router 替代硬跳转
          // 通过事件通知 App 组件进行路由跳转，保持 SPA 状态
          globalThis.dispatchEvent(new CustomEvent('auth:admin-expired'));
        } else if (!isAdminRequest && !isLoginRequest) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          // 修复 F-003/F-004：通过事件通知，避免硬跳转
          globalThis.dispatchEvent(new CustomEvent('auth:user-expired'));
        }
      }
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

// 管理后台专用请求方法
async function adminRequest<T>(url: string, options?: RequestInit): Promise<T> {
  return request<T>(url, options, true);
}

// ==================== 认证相关 ====================

export const authApi = {
  // 发送短信验证码
  sendSmsCode: async (phone: string, type: 'register' | 'login' | 'reset_password'): Promise<{ success: boolean }> => {
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

// ==================== 活体相关 ====================

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

// ==================== 订单相关 ====================

export const orderApi = {
  // 创建领养订单
  // 后端返回完整的 Order 对象
  create: async (data: { livestockId: string; quantity?: number; clientOrderId: string }): Promise<{ id: string; orderNo: string; expireAt: string; [key: string]: any }> => {
    return request('/orders/adoption', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 取消订单
  cancel: async (orderId: string): Promise<{ success: boolean }> => {
    return request(`/orders/adoption/${orderId}/cancel`, { method: 'POST' });
  },

  // 获取订单详情
  getById: async (orderId: string): Promise<AdoptionOrder> => {
    return request(`/orders/adoption/${orderId}`);
  },

  // 获取我的订单列表
  getMyOrders: async (params?: { status?: number; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status !== undefined) query.set('status', params.status.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/orders/adoption?${query.toString()}`);
  }
};

// ==================== 领养相关 ====================

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

// ==================== 买断相关 ====================

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
    const query = status !== undefined ? `?status=${status}` : '';
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

// ==================== 支付相关 ====================

export const paymentApi = {
  // 发起支付
  create: async (data: { orderType: 'adoption' | 'feed' | 'redemption' | 'recharge'; orderId: string; paymentMethod: 'alipay' | 'wechat' | 'balance'; amount?: number }): Promise<PaymentResult> => {
    return request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 查询支付状态
  getStatus: async (paymentNo: string): Promise<{ status: number; paidAt?: string }> => {
    return request(`/payments/${paymentNo}`);
  }
};

// ==================== 余额相关 ====================

export const balanceApi = {
  // 获取余额
  get: async (): Promise<{ balance: number }> => {
    return request('/balance');
  },

  // 获取余额流水
  getLogs: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<BalanceLog>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/balance/logs?${query.toString()}`);
  },

  // 充值余额（使用专用接口，订单ID由后端生成）
  recharge: async (amount: number, paymentMethod: 'alipay' | 'wechat'): Promise<PaymentResult> => {
    return request('/payments/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod }),
    });
  }
};

// ==================== 协议相关 ====================

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

// ==================== 站点配置 ====================

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

// ==================== 退款相关 ====================

export const refundApi = {
  // 申请退款
  apply: async (data: { orderType: 'adoption' | 'feed' | 'redemption'; orderId: string; reason: string }): Promise<{ refundId: string; refundNo: string }> => {
    return request('/refunds/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取退款详情
  getById: async (refundId: string): Promise<RefundOrder> => {
    return request(`/refunds/${refundId}`);
  },

  // 获取我的退款列表
  getMyRefunds: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RefundOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/refunds/my?${query.toString()}`);
  }
};

// ==================== 消息相关 ====================

export const notificationApi = {
  // 获取站内信列表
  getList: async (params?: { type?: string; isRead?: number; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.isRead !== undefined) query.set('isRead', params.isRead.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/notifications?${query.toString()}`);
  },

  // 获取未读消息数量
  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await request<{ unreadCount: number; totalCount: number }>('/notifications/unread-count');
    return { count: res.unreadCount };
  },

  // 标记已读
  markRead: async (notificationId: string): Promise<{ success: boolean }> => {
    return request(`/notifications/${notificationId}/read`, { method: 'POST' });
  },

  // 标记全部已读
  markAllRead: async (): Promise<{ success: boolean }> => {
    return request('/notifications/read-all', { method: 'POST' });
  }
};

// ==================== 后台管理相关 ====================

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
      method: 'PUT',
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

  auditRefund: async (id: string, data: { passed: boolean; refundAmount: number; remark?: string; confirmToken?: string }): Promise<any> => {
    return adminRequest(`/refunds/admin/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 管理员直接退款（无需审核）
  adminRefund: async (data: { userId: string; amount: number; reason: string; orderType?: string; orderId?: string }): Promise<RefundOrder> => {
    return adminRequest('/refunds/admin/refund', {
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
      method: 'PUT',
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

  // 验证管理员密码（敏感操作确认）
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
