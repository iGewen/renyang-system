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

// 模拟网络延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 通用请求方法（后续替换为真实 axios）
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // TODO: 替换为真实的 axios 请求
  // const response = await fetch(`${API_BASE}${url}`, options);
  // return response.json();

  // 目前返回 mock 数据
  await delay(500);
  return {} as T;
}

// ==================== 认证相关 ====================

export const authApi = {
  // 发送短信验证码
  sendSmsCode: async (phone: string, type: 'register' | 'login' | 'reset_password'): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  // 用户注册
  register: async (data: { phone: string; code: string; password: string }): Promise<{ token: string; user: User }> => {
    await delay(500);
    return {
      token: 'mock_token_' + Date.now(),
      user: {
        id: '1',
        phone: data.phone,
        nickname: '新用户',
        balance: 0,
        status: 'normal',
        createdAt: new Date().toISOString()
      }
    };
  },

  // 密码登录
  loginByPassword: async (data: { phone: string; password: string }): Promise<{ token: string; user: User }> => {
    await delay(500);
    return {
      token: 'mock_token_' + Date.now(),
      user: {
        id: '1',
        phone: data.phone,
        nickname: '微信用户',
        balance: 1280,
        status: 'normal',
        createdAt: '2026-01-01T00:00:00Z'
      }
    };
  },

  // 验证码登录
  loginByCode: async (data: { phone: string; code: string }): Promise<{ token: string; user: User }> => {
    await delay(500);
    return {
      token: 'mock_token_' + Date.now(),
      user: {
        id: '1',
        phone: data.phone,
        nickname: '微信用户',
        balance: 1280,
        status: 'normal',
        createdAt: '2026-01-01T00:00:00Z'
      }
    };
  },

  // 获取微信授权URL
  getWechatAuthUrl: async (): Promise<{ url: string }> => {
    await delay(200);
    return { url: 'https://open.weixin.qq.com/connect/oauth2?...' };
  },

  // 微信授权回调
  wechatCallback: async (code: string, state: string): Promise<{ needBindPhone: boolean; tempToken?: string; token?: string; user?: User }> => {
    await delay(500);
    return {
      needBindPhone: true,
      tempToken: 'temp_token_' + Date.now()
    };
  },

  // 绑定手机号
  bindPhone: async (data: { tempToken: string; phone: string; code: string }): Promise<{ token: string; user: User }> => {
    await delay(500);
    return {
      token: 'mock_token_' + Date.now(),
      user: {
        id: '1',
        phone: data.phone,
        nickname: '微信用户',
        balance: 0,
        status: 'normal',
        createdAt: new Date().toISOString()
      }
    };
  },

  // 重置密码
  resetPassword: async (data: { phone: string; code: string; newPassword: string }): Promise<{ success: boolean }> => {
    await delay(500);
    return { success: true };
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<User> => {
    await delay(300);
    return {
      id: '1',
      phone: '138****8888',
      nickname: '微信用户',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      balance: 1280,
      status: 'normal',
      createdAt: '2026-01-01T00:00:00Z',
      stats: {
        adoptions: 2,
        days: 128,
        saved: 350
      }
    };
  },

  // 更新用户信息
  updateCurrentUser: async (data: { nickname?: string; avatar?: string }): Promise<User> => {
    await delay(300);
    return {
      id: '1',
      phone: '138****8888',
      nickname: data.nickname || '微信用户',
      avatar: data.avatar,
      balance: 1280,
      status: 'normal',
      createdAt: '2026-01-01T00:00:00Z'
    };
  }
};

// ==================== 活体相关 ====================

export const livestockApi = {
  // 获取活体类型列表
  getTypes: async (): Promise<LivestockType[]> => {
    await delay(300);
    return [
      { id: '1', name: '羊', code: 'sheep', sortOrder: 1, status: 'enabled' },
      { id: '2', name: '鸡', code: 'chicken', sortOrder: 2, status: 'enabled' },
      { id: '3', name: '鸵鸟', code: 'ostrich', sortOrder: 3, status: 'enabled' }
    ];
  },

  // 获取活体列表
  getList: async (params?: { typeId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    await delay(500);
    const { LIVESTOCK_DATA } = await import('../types');
    return {
      list: LIVESTOCK_DATA,
      total: LIVESTOCK_DATA.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 10,
      totalPages: 1
    };
  },

  // 获取活体详情
  getById: async (id: string): Promise<Livestock | undefined> => {
    await delay(300);
    const { LIVESTOCK_DATA } = await import('../types');
    return LIVESTOCK_DATA.find(item => item.id === id);
  }
};

// ==================== 订单相关 ====================

export const orderApi = {
  // 创建领养订单
  create: async (data: { livestockId: string; quantity?: number; clientOrderId: string }): Promise<{ orderId: string; orderNo: string; expireAt: string }> => {
    await delay(500);
    return {
      orderId: 'order_' + Date.now(),
      orderNo: 'ORD' + Date.now().toString(36).toUpperCase(),
      expireAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  },

  // 取消订单
  cancel: async (orderId: string): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  // 获取订单详情
  getById: async (orderId: string): Promise<AdoptionOrder> => {
    await delay(300);
    return {} as AdoptionOrder;
  },

  // 获取我的订单列表
  getMyOrders: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  }
};

// ==================== 领养相关 ====================

export const adoptionApi = {
  // 获取我的领养列表
  getMyAdoptions: async (): Promise<Adoption[]> => {
    await delay(500);
    const { LIVESTOCK_DATA } = await import('../types');
    return [
      {
        id: 'ADPT-X92J1K',
        adoptionNo: 'ADPT-X92J1K',
        orderId: 'order_1',
        userId: '1',
        livestockId: '1',
        livestockSnapshot: LIVESTOCK_DATA[0],
        livestock: LIVESTOCK_DATA[0],
        startDate: '2026-01-15',
        redemptionMonths: 12,
        feedMonthsPaid: 3,
        totalFeedAmount: 450,
        lateFeeAmount: 0,
        status: 'active',
        days: 78,
        nextPayment: '2026-04-15',
        isException: false,
        createdAt: '2026-01-15T00:00:00Z'
      }
    ];
  },

  // 获取领养详情
  getById: async (adoptionId: string): Promise<Adoption> => {
    await delay(300);
    return {} as Adoption;
  },

  // 获取饲料费账单列表
  getFeedBills: async (adoptionId: string): Promise<FeedBill[]> => {
    await delay(500);
    return [];
  },

  // 获取饲料费账单详情
  getFeedBillById: async (billId: string): Promise<FeedBill> => {
    await delay(300);
    return {} as FeedBill;
  },

  // 支付饲料费
  payFeedBill: async (billId: string, paymentMethod: 'alipay' | 'wechat' | 'balance'): Promise<PaymentResult> => {
    await delay(500);
    if (paymentMethod === 'balance') {
      return { paymentNo: 'PAY' + Date.now() };
    }
    return {
      payUrl: 'https://payment.example.com/pay/' + Date.now(),
      paymentNo: 'PAY' + Date.now()
    };
  },

  // 申请买断
  applyRedemption: async (adoptionId: string, clientOrderId: string): Promise<{ redemptionId: string; redemptionNo: string; amount: number; type: 'full' | 'early' }> => {
    await delay(500);
    return {
      redemptionId: 'redemption_' + Date.now(),
      redemptionNo: 'RDM' + Date.now().toString(36).toUpperCase(),
      amount: 0,
      type: 'full'
    };
  }
};

// ==================== 买断相关 ====================

export const redemptionApi = {
  // 获取买断详情
  getById: async (redemptionId: string): Promise<RedemptionOrder> => {
    await delay(300);
    return {} as RedemptionOrder;
  },

  // 支付买断
  pay: async (redemptionId: string, paymentMethod: 'alipay' | 'wechat' | 'balance'): Promise<PaymentResult> => {
    await delay(500);
    if (paymentMethod === 'balance') {
      return { paymentNo: 'PAY' + Date.now() };
    }
    return {
      payUrl: 'https://payment.example.com/pay/' + Date.now(),
      paymentNo: 'PAY' + Date.now()
    };
  }
};

// ==================== 支付相关 ====================

export const paymentApi = {
  // 发起支付
  create: async (data: { orderType: 'adoption' | 'feed' | 'redemption' | 'recharge'; orderId: string; paymentMethod: 'alipay' | 'wechat' | 'balance'; amount?: number }): Promise<PaymentResult> => {
    await delay(500);
    if (data.paymentMethod === 'balance') {
      return { paymentNo: 'PAY' + Date.now() };
    }
    return {
      payUrl: 'https://payment.example.com/pay/' + Date.now(),
      paymentNo: 'PAY' + Date.now()
    };
  },

  // 查询支付状态
  getStatus: async (paymentNo: string): Promise<{ status: number; paidAt?: string }> => {
    await delay(200);
    return { status: 2, paidAt: new Date().toISOString() };
  }
};

// ==================== 余额相关 ====================

export const balanceApi = {
  // 获取余额
  get: async (): Promise<{ balance: number }> => {
    await delay(200);
    return { balance: 1280 };
  },

  // 获取余额流水
  getLogs: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<BalanceLog>> => {
    await delay(500);
    return {
      list: [
        {
          id: '1',
          userId: '1',
          type: 'recharge',
          amount: 500,
          balanceBefore: 780,
          balanceAfter: 1280,
          remark: '余额充值',
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1
    };
  },

  // 充值余额
  recharge: async (amount: number, paymentMethod: 'alipay' | 'wechat'): Promise<PaymentResult> => {
    await delay(500);
    return {
      payUrl: 'https://payment.example.com/pay/' + Date.now(),
      paymentNo: 'PAY' + Date.now()
    };
  }
};

// ==================== 退款相关 ====================

export const refundApi = {
  // 申请退款
  apply: async (data: { orderType: 'adoption' | 'feed' | 'redemption'; orderId: string; reason: string }): Promise<{ refundId: string; refundNo: string }> => {
    await delay(500);
    return {
      refundId: 'refund_' + Date.now(),
      refundNo: 'RFD' + Date.now().toString(36).toUpperCase()
    };
  },

  // 获取退款详情
  getById: async (refundId: string): Promise<RefundOrder> => {
    await delay(300);
    return {} as RefundOrder;
  },

  // 获取我的退款列表
  getMyRefunds: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RefundOrder>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  }
};

// ==================== 消息相关 ====================

export const notificationApi = {
  // 获取站内信列表
  getList: async (params?: { type?: string; isRead?: number; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    await delay(500);
    return {
      list: [
        {
          id: '1',
          title: '领养成功通知',
          content: '您已成功领养苏尼特羊，请按时缴纳饲料费。',
          type: 'order',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: '饲料费缴纳提醒',
          content: '您的饲料费账单将于5天后到期，请及时缴纳。',
          type: 'feed',
          isRead: true,
          readAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1
    };
  },

  // 获取未读消息数量
  getUnreadCount: async (): Promise<{ count: number }> => {
    await delay(200);
    return { count: 3 };
  },

  // 标记已读
  markRead: async (notificationId: string): Promise<{ success: boolean }> => {
    await delay(200);
    return { success: true };
  },

  // 标记全部已读
  markAllRead: async (): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  }
};

// ==================== 后台管理相关 ====================

export const adminApi = {
  // ==================== 认证 ====================
  login: async (data: { username: string; password: string }): Promise<{ token: string; admin: Admin }> => {
    await delay(500);
    return {
      token: 'admin_token_' + Date.now(),
      admin: {
        id: '1',
        username: 'admin',
        name: '超级管理员',
        role: 'super_admin',
        status: 'enabled',
        createdAt: '2026-01-01T00:00:00Z'
      }
    };
  },

  getCurrentAdmin: async (): Promise<Admin> => {
    await delay(300);
    return {
      id: '1',
      username: 'admin',
      name: '超级管理员',
      role: 'super_admin',
      status: 'enabled',
      createdAt: '2026-01-01T00:00:00Z'
    };
  },

  updatePassword: async (data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  // ==================== 数据统计 ====================
  getDashboardStats: async (): Promise<DashboardStats> => {
    await delay(500);
    return {
      orderTotal: 342,
      orderPaid: 289,
      orderToday: 15,
      orderMonth: 128,
      orderYear: 289,
      revenueToday: 15800,
      revenueMonth: 128450,
      revenueYear: 892340,
      refundCount: 12,
      refundAmount: 8900,
      refundToday: 1,
      adoptionByType: [
        { typeId: '1', typeName: '羊', count: 150 },
        { typeId: '2', typeName: '鸡', count: 80 },
        { typeId: '3', typeName: '鸵鸟', count: 59 }
      ],
      pendingOrders: 5,
      pendingRedemptions: 3,
      exceptionAdoptions: 2,
      pendingRefunds: 4,
      userTotal: 1284,
      userToday: 28,
      activeUsers: 356
    };
  },

  getDashboardTrend: async (type: 'revenue' | 'order' | 'user', range: 'week' | 'month' | 'year'): Promise<{ dates: string[]; values: number[] }> => {
    await delay(300);
    const dates = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
      values.push(Math.floor(Math.random() * 10000) + 1000);
    }
    return { dates, values };
  },

  // ==================== 活体管理 ====================
  getLivestockTypes: async (): Promise<LivestockType[]> => {
    await delay(300);
    return [
      { id: '1', name: '羊', code: 'sheep', sortOrder: 1, status: 'enabled' },
      { id: '2', name: '鸡', code: 'chicken', sortOrder: 2, status: 'enabled' },
      { id: '3', name: '鸵鸟', code: 'ostrich', sortOrder: 3, status: 'enabled' }
    ];
  },

  createLivestockType: async (data: Partial<LivestockType>): Promise<LivestockType> => {
    await delay(300);
    return { id: Date.now().toString(), ...data, sortOrder: 0, status: 'enabled' } as LivestockType;
  },

  updateLivestockType: async (id: string, data: Partial<LivestockType>): Promise<LivestockType> => {
    await delay(300);
    return { id, ...data } as LivestockType;
  },

  deleteLivestockType: async (id: string): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  getLivestockList: async (params?: { typeId?: string; status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Livestock>> => {
    await delay(500);
    const { LIVESTOCK_DATA } = await import('../types');
    return {
      list: LIVESTOCK_DATA,
      total: LIVESTOCK_DATA.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 10,
      totalPages: 1
    };
  },

  createLivestock: async (data: Partial<Livestock>): Promise<Livestock> => {
    await delay(500);
    return { id: Date.now().toString(), ...data } as Livestock;
  },

  updateLivestock: async (id: string, data: Partial<Livestock>): Promise<Livestock> => {
    await delay(300);
    return { id, ...data } as Livestock;
  },

  deleteLivestock: async (id: string): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  updateLivestockStatus: async (id: string, status: 'on_sale' | 'off_sale'): Promise<Livestock> => {
    await delay(300);
    return { id, status } as Livestock;
  },

  updateLivestockStock: async (id: string, stock: number, reason?: string): Promise<Livestock> => {
    await delay(300);
    return { id, stock } as Livestock;
  },

  // ==================== 订单管理 ====================
  getOrders: async (params?: { status?: string; orderNo?: string; userPhone?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AdoptionOrder>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  getOrderById: async (id: string): Promise<AdoptionOrder> => {
    await delay(300);
    return {} as AdoptionOrder;
  },

  // ==================== 饲料费管理 ====================
  getFeedBills: async (params?: { status?: string; billNo?: string; userPhone?: string; isOverdue?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<FeedBill>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  adjustFeedBill: async (id: string, data: { adjustedAmount: number; reason: string }): Promise<FeedBill> => {
    await delay(300);
    return {} as FeedBill;
  },

  waiveFeedBill: async (id: string, reason: string): Promise<FeedBill> => {
    await delay(300);
    return {} as FeedBill;
  },

  waiveLateFee: async (id: string, reason: string): Promise<FeedBill> => {
    await delay(300);
    return {} as FeedBill;
  },

  getExceptionAdoptions: async (params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Adoption>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  resolveException: async (id: string, data: { action: 'contact' | 'terminate' | 'continue'; remark: string }): Promise<Adoption> => {
    await delay(300);
    return {} as Adoption;
  },

  // ==================== 买断管理 ====================
  getRedemptions: async (params?: { status?: string; type?: string; userPhone?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RedemptionOrder>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  getRedemptionById: async (id: string): Promise<RedemptionOrder> => {
    await delay(300);
    return {} as RedemptionOrder;
  },

  auditRedemption: async (id: string, data: { approved: boolean; adjustedAmount?: number; remark?: string }): Promise<RedemptionOrder> => {
    await delay(300);
    return {} as RedemptionOrder;
  },

  // ==================== 退款管理 ====================
  getRefunds: async (params?: { status?: string; refundNo?: string; userPhone?: string; orderType?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RefundOrder>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  getRefundById: async (id: string): Promise<RefundOrder> => {
    await delay(300);
    return {} as RefundOrder;
  },

  auditRefund: async (id: string, data: { approved: boolean; remark?: string }): Promise<RefundOrder> => {
    await delay(300);
    return {} as RefundOrder;
  },

  manualRefund: async (data: { orderType: string; orderId: string; refundAmount: number; refundLivestock: 'yes' | 'no'; reason: string; confirmPassword: string }): Promise<RefundOrder> => {
    await delay(500);
    return {} as RefundOrder;
  },

  // ==================== 用户管理 ====================
  getUsers: async (params?: { status?: string; keyword?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<User>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  getUserById: async (id: string): Promise<User> => {
    await delay(300);
    return {} as User;
  },

  getUserAdoptions: async (id: string): Promise<Adoption[]> => {
    await delay(300);
    return [];
  },

  getUserOrders: async (id: string): Promise<AdoptionOrder[]> => {
    await delay(300);
    return [];
  },

  getUserBalanceLogs: async (id: string): Promise<BalanceLog[]> => {
    await delay(300);
    return [];
  },

  adjustUserBalance: async (id: string, data: { amount: number; reason: string; confirmPassword: string }): Promise<User> => {
    await delay(300);
    return {} as User;
  },

  updateUserStatus: async (id: string, data: { status: 'normal' | 'restricted' | 'banned'; reason: string }): Promise<User> => {
    await delay(300);
    return {} as User;
  },

  // ==================== 消息管理 ====================
  getNotifications: async (params?: { type?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Notification>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  sendNotification: async (data: { userIds?: string[]; title: string; content: string; type: string }): Promise<{ success: boolean; sendCount: number }> => {
    await delay(500);
    return { success: true, sendCount: data.userIds?.length || 100 };
  },

  // ==================== 系统配置 ====================
  getConfigs: async (configType?: string): Promise<SystemConfig[]> => {
    await delay(300);
    return [
      { id: '1', configKey: 'alipay_config', configValue: {}, configType: 'payment', description: '支付宝H5配置', isEncrypted: true },
      { id: '2', configKey: 'wechat_pay_config', configValue: {}, configType: 'payment', description: '微信H5支付配置', isEncrypted: true },
      { id: '3', configKey: 'wechat_login_config', configValue: { enabled: false }, configType: 'payment', description: '微信登录配置', isEncrypted: true },
      { id: '4', configKey: 'aliyun_sms_config', configValue: {}, configType: 'sms', description: '阿里云短信配置', isEncrypted: true },
      { id: '5', configKey: 'order_config', configValue: { expireMinutes: 15, feedBillAdvanceDays: 5, lateFeeStartDays: 3, exceptionDays: 7 }, configType: 'business', description: '订单配置', isEncrypted: false },
      { id: '6', configKey: 'late_fee_config', configValue: { rate: 0.001, capRate: 0.5 }, configType: 'business', description: '滞纳金配置', isEncrypted: false },
      { id: '7', configKey: 'platform_config', configValue: { name: '云端牧场', customerServicePhone: '', customerServiceHours: '9:00-21:00' }, configType: 'other', description: '平台基础配置', isEncrypted: false }
    ];
  },

  updateConfig: async (key: string, value: any): Promise<SystemConfig> => {
    await delay(300);
    return {} as SystemConfig;
  },

  testPayment: async (type: 'alipay' | 'wechat'): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    return { success: true, message: '配置测试成功' };
  },

  testSms: async (phone: string): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    return { success: true, message: '短信发送成功' };
  },

  // ==================== 管理员管理 ====================
  getAdmins: async (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Admin>> => {
    await delay(500);
    return {
      list: [
        { id: '1', username: 'admin', name: '超级管理员', role: 'super_admin', status: 'enabled', createdAt: '2026-01-01T00:00:00Z' }
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1
    };
  },

  createAdmin: async (data: { username: string; password: string; name: string; phone?: string; role: 'super_admin' | 'admin' }): Promise<Admin> => {
    await delay(300);
    return { id: Date.now().toString(), ...data, status: 'enabled', createdAt: new Date().toISOString() } as Admin;
  },

  updateAdmin: async (id: string, data: Partial<Admin>): Promise<Admin> => {
    await delay(300);
    return { id, ...data } as Admin;
  },

  resetAdminPassword: async (id: string, newPassword: string): Promise<{ success: boolean }> => {
    await delay(300);
    return { success: true };
  },

  updateAdminStatus: async (id: string, status: 'enabled' | 'disabled'): Promise<Admin> => {
    await delay(300);
    return { id, status } as Admin;
  },

  // ==================== 审计日志 ====================
  getAuditLogs: async (params?: { adminId?: string; module?: string; action?: string; isSensitive?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AuditLog>> => {
    await delay(500);
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    };
  },

  getAuditLogById: async (id: string): Promise<AuditLog> => {
    await delay(300);
    return {} as AuditLog;
  }
};
