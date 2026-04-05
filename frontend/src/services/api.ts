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

const API_BASE = '/api';

// 通用请求方法
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data.data || data;
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
    return request(`/auth/wechat/callback?code=${code}&state=${state}`);
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
    return request('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<User> => {
    return request('/user/profile');
  },

  // 更新用户信息
  updateCurrentUser: async (data: { nickname?: string; avatar?: string }): Promise<User> => {
    return request('/user/profile', {
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
  create: async (data: { livestockId: string; quantity?: number; clientOrderId: string }): Promise<{ orderId: string; orderNo: string; expireAt: string }> => {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 取消订单
  cancel: async (orderId: string): Promise<{ success: boolean }> => {
    return request(`/orders/${orderId}/cancel`, { method: 'POST' });
  },

  // 获取订单详情
  getById: async (orderId: string): Promise<AdoptionOrder> => {
    return request(`/orders/${orderId}`);
  },

  // 获取我的订单列表
  getMyOrders: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/orders/my?${query.toString()}`);
  }
};

// ==================== 领养相关 ====================

export const adoptionApi = {
  // 获取我的领养列表
  getMyAdoptions: async (): Promise<Adoption[]> => {
    return request('/adoptions/my');
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
    return request(`/feed-bills/${billId}`);
  },

  // 支付饲料费
  payFeedBill: async (billId: string, paymentMethod: 'alipay' | 'wechat' | 'balance'): Promise<PaymentResult> => {
    return request(`/feed-bills/${billId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },

  // 申请买断
  applyRedemption: async (adoptionId: string, clientOrderId: string): Promise<{ redemptionId: string; redemptionNo: string; amount: number; type: 'full' | 'early' }> => {
    return request(`/adoptions/${adoptionId}/redemption`, {
      method: 'POST',
      body: JSON.stringify({ clientOrderId }),
    });
  }
};

// ==================== 买断相关 ====================

export const redemptionApi = {
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
    return request('/payment/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 查询支付状态
  getStatus: async (paymentNo: string): Promise<{ status: number; paidAt?: string }> => {
    return request(`/payment/status/${paymentNo}`);
  }
};

// ==================== 余额相关 ====================

export const balanceApi = {
  // 获取余额
  get: async (): Promise<{ balance: number }> => {
    return request('/user/balance');
  },

  // 获取余额流水
  getLogs: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<BalanceLog>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/user/balance/logs?${query.toString()}`);
  },

  // 充值余额
  recharge: async (amount: number, paymentMethod: 'alipay' | 'wechat'): Promise<PaymentResult> => {
    return request('/user/balance/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod }),
    });
  }
};

// ==================== 协议相关 ====================

export const agreementApi = {
  // 获取协议内容
  get: async (type: 'user' | 'adoption' | 'privacy' | 'disclaimer' | string): Promise<{ title: string; content: string; updatedAt: string }> => {
    return request(`/users/agreements/${type}`);
  },

  // 获取协议列表
  getList: async (): Promise<{ key: string; title: string; updatedAt: string }[]> => {
    return request('/users/agreements');
  }
};

// ==================== 退款相关 ====================

export const refundApi = {
  // 申请退款
  apply: async (data: { orderType: 'adoption' | 'feed' | 'redemption'; orderId: string; reason: string }): Promise<{ refundId: string; refundNo: string }> => {
    return request('/refunds', {
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
    return request('/notifications/unread-count');
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
    return request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCurrentAdmin: async (): Promise<Admin> => {
    return request('/admin/auth/info');
  },

  updatePassword: async (data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean }> => {
    return request('/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 数据统计 ====================
  getDashboardStats: async (): Promise<DashboardStats> => {
    return request('/admin/dashboard/stats');
  },

  getDashboardTrend: async (type: 'revenue' | 'order' | 'user', range: 'week' | 'month' | 'year'): Promise<{ dates: string[]; values: number[] }> => {
    return request(`/admin/dashboard/trend?type=${type}&range=${range}`);
  },

  // ==================== 活体管理 ====================
  getLivestockTypes: async (): Promise<LivestockType[]> => {
    return request('/admin/livestock-types');
  },

  createLivestockType: async (data: Partial<LivestockType>): Promise<LivestockType> => {
    return request('/admin/livestock-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateLivestockType: async (id: string, data: Partial<LivestockType>): Promise<LivestockType> => {
    return request(`/admin/livestock-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteLivestockType: async (id: string): Promise<{ success: boolean }> => {
    return request(`/admin/livestock-types/${id}`, { method: 'DELETE' });
  },

  getLivestockList: async (params?: { typeId?: string; status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    const query = new URLSearchParams();
    if (params?.typeId) query.set('typeId', params.typeId);
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/admin/livestock?${query.toString()}`);
  },

  createLivestock: async (data: Partial<Livestock>): Promise<Livestock> => {
    return request('/admin/livestock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateLivestock: async (id: string, data: Partial<Livestock>): Promise<Livestock> => {
    return request(`/admin/livestock/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteLivestock: async (id: string): Promise<{ success: boolean }> => {
    return request(`/admin/livestock/${id}`, { method: 'DELETE' });
  },

  updateLivestockStatus: async (id: string, status: 'on_sale' | 'off_sale'): Promise<Livestock> => {
    return request(`/admin/livestock/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  updateLivestockStock: async (id: string, stock: number, reason?: string): Promise<Livestock> => {
    return request(`/admin/livestock/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ stock, reason }),
    });
  },

  // ==================== 订单管理 ====================
  getOrders: async (params?: { status?: string; orderNo?: string; userPhone?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.orderNo) query.set('orderNo', params.orderNo);
    if (params?.userPhone) query.set('userPhone', params.userPhone);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/admin/orders?${query.toString()}`);
  },

  getOrderById: async (id: string): Promise<AdoptionOrder> => {
    return request(`/admin/orders/${id}`);
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
    return request(`/admin/feed-bills?${query.toString()}`);
  },

  adjustFeedBill: async (id: string, data: { adjustedAmount: number; reason: string }): Promise<FeedBill> => {
    return request(`/admin/feed-bills/${id}/adjust`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  waiveFeedBill: async (id: string, reason: string): Promise<FeedBill> => {
    return request(`/admin/feed-bills/${id}/waive`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  waiveLateFee: async (id: string, reason: string): Promise<FeedBill> => {
    return request(`/admin/feed-bills/${id}/waive-late-fee`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  getExceptionAdoptions: async (params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Adoption>> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/admin/adoptions/exception?${query.toString()}`);
  },

  resolveException: async (id: string, data: { action: 'contact' | 'terminate' | 'continue'; remark: string }): Promise<Adoption> => {
    return request(`/admin/adoptions/${id}/resolve`, {
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
    return request(`/admin/redemptions?${query.toString()}`);
  },

  getRedemptionById: async (id: string): Promise<RedemptionOrder> => {
    return request(`/admin/redemptions/${id}`);
  },

  auditRedemption: async (id: string, data: { approved: boolean; adjustedAmount?: number; remark?: string }): Promise<RedemptionOrder> => {
    return request(`/admin/redemptions/${id}/audit`, {
      method: 'PUT',
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
    return request(`/admin/refunds?${query.toString()}`);
  },

  getRefundById: async (id: string): Promise<RefundOrder> => {
    return request(`/admin/refunds/${id}`);
  },

  auditRefund: async (id: string, data: { approved: boolean; remark?: string }): Promise<RefundOrder> => {
    return request(`/admin/refunds/${id}/audit`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  manualRefund: async (data: { orderType: string; orderId: string; refundAmount: number; refundLivestock: 'yes' | 'no'; reason: string; confirmPassword: string }): Promise<RefundOrder> => {
    return request('/admin/refunds/manual', {
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
    return request(`/admin/users?${query.toString()}`);
  },

  getUserById: async (id: string): Promise<User> => {
    return request(`/admin/users/${id}`);
  },

  getUserAdoptions: async (id: string): Promise<Adoption[]> => {
    return request(`/admin/users/${id}/adoptions`);
  },

  getUserOrders: async (id: string): Promise<AdoptionOrder[]> => {
    return request(`/admin/users/${id}/orders`);
  },

  getUserBalanceLogs: async (id: string): Promise<BalanceLog[]> => {
    return request(`/admin/users/${id}/balance-logs`);
  },

  adjustUserBalance: async (id: string, data: { amount: number; reason: string; confirmPassword: string }): Promise<User> => {
    return request(`/admin/users/${id}/balance`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateUserStatus: async (id: string, data: { status: 'normal' | 'restricted' | 'banned'; reason: string }): Promise<User> => {
    return request(`/admin/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ==================== 消息管理 ====================
  getNotifications: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request(`/admin/notifications?${query.toString()}`);
  },

  sendNotification: async (data: { userIds?: string[]; title: string; content: string; type: string }): Promise<{ success: boolean; sendCount: number }> => {
    return request('/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== 系统配置 ====================
  getConfigs: async (configType?: string): Promise<SystemConfig[]> => {
    const query = configType ? `?type=${configType}` : '';
    return request(`/admin/system-config${query}`);
  },

  updateConfig: async (key: string, value: any): Promise<SystemConfig> => {
    return request(`/admin/system-config`, {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  },

  testPayment: async (type: 'alipay' | 'wechat'): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/configs/test-payment/${type}`, { method: 'POST' });
  },

  testSms: async (phone: string): Promise<{ success: boolean; message: string }> => {
    return request('/admin/configs/test-sms', {
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
    return request(`/admin/admins?${query.toString()}`);
  },

  createAdmin: async (data: { username: string; password: string; name: string; phone?: string; role: 'super_admin' | 'admin' }): Promise<Admin> => {
    return request('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAdmin: async (id: string, data: Partial<Admin>): Promise<Admin> => {
    return request(`/admin/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  resetAdminPassword: async (id: string, newPassword: string): Promise<{ success: boolean }> => {
    return request(`/admin/admins/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  },

  updateAdminStatus: async (id: string, status: 'enabled' | 'disabled'): Promise<Admin> => {
    return request(`/admin/admins/${id}/status`, {
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
    return request(`/admin/audit-logs?${query.toString()}`);
  },

  getAuditLogById: async (id: string): Promise<AuditLog> => {
    return request(`/admin/audit-logs/${id}`);
  },

  // ==================== 协议管理 ====================
  getAgreements: async (): Promise<{ id: string; agreementKey: string; title: string; content: string; createdAt: string; updatedAt: string }[]> => {
    return request('/admin/agreements');
  },

  getAgreement: async (key: string): Promise<{ id: string; agreementKey: string; title: string; content: string; createdAt: string; updatedAt: string }> => {
    return request(`/admin/agreements/${key}`);
  },

  saveAgreement: async (data: { agreementKey: string; title: string; content: string }): Promise<{ success: boolean; id: string }> => {
    return request('/admin/agreements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteAgreement: async (key: string): Promise<{ success: boolean }> => {
    return request(`/admin/agreements/${key}`, { method: 'DELETE' });
  }
};
