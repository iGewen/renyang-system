/**
 * 安全解析 JWT payload
 * 修复 F-002：支持非ASCII字符（如中文用户名）
 */
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

// Token 管理工具
export const TokenManager = {
  getUserToken: (): string | null => {
    const token = sessionStorage.getItem('token');
    if (!token) return null;

    const payload = safeParseJwtPayload(token);
    if (!payload) {
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

  setUserToken: (token: string): void => {
    sessionStorage.setItem('token', token);
  },

  setAdminToken: (token: string): void => {
    sessionStorage.setItem('admin_token', token);
  },

  clearUserToken: (): void => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  },

  clearAdminToken: (): void => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_info');
  },

  clearAll: (): void => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('admin_info');
  }
};

// ==================== 认证相关 ====================

// 从独立文件导入
export { authApi } from './auth.api';

// ==================== 活体相关 ====================

// 从独立文件导入
export { livestockApi } from './livestock.api';

// ==================== 订单相关 ====================

// 从独立文件导入
export { orderApi } from './order.api';

// ==================== 领养相关 ====================

// 从独立文件导入
export { adoptionApi } from './adoption.api';

// ==================== 买断相关 ====================

// 从独立文件导入
export { redemptionApi } from './redemption.api';

// ==================== 支付相关 ====================

// 从独立文件导入
export { paymentApi } from './payment.api';

// ==================== 余额相关 ====================

// 从独立文件导入
export { balanceApi } from './balance.api';

// ==================== 协议相关 ====================

// 从独立文件导入
export { agreementApi } from './agreement.api';

// ==================== 站点配置 ====================

// 从独立文件导入
export { siteConfigApi } from './site-config.api';

// ==================== 退款相关 ====================

// 从独立文件导入
export { refundApi } from './refund.api';

// ==================== 消息相关 ====================

// 从独立文件导入
export { notificationApi } from './notification.api';

// ==================== 后台管理相关 ====================

// 从独立文件导入
export { adminApi } from './admin.api';

// ==================== 钱包相关 ====================

// 从独立文件导入
export { walletApi } from './wallet.api';
export type { TransactionRecord, TransactionDetail } from './wallet.api';
