/**
 * 状态配置映射工具
 * 统一管理各类型状态的显示配置
 */

import { OrderStatus, AdoptionStatus, FeedBillStatus, RedemptionStatus, RefundStatus } from '../types/enums';

// 通用状态配置类型
export interface StatusConfig {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  color: string;
}

// ==================== 订单状态 ====================

export const getOrderStatusConfig = (status: OrderStatus | number): StatusConfig => {
  const map: Record<number, StatusConfig> = {
    [OrderStatus.PENDING_PAYMENT]: {
      label: '待付款',
      variant: 'warning',
      color: 'text-orange-600 bg-orange-50'
    },
    [OrderStatus.PAID]: {
      label: '已支付',
      variant: 'success',
      color: 'text-green-600 bg-green-50'
    },
    [OrderStatus.CANCELLED]: {
      label: '已取消',
      variant: 'default',
      color: 'text-slate-500 bg-slate-100'
    },
    [OrderStatus.REFUNDED]: {
      label: '已退款',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    }
  };
  return map[status] || { label: '未知', variant: 'default', color: 'text-slate-500 bg-slate-100' };
};

// ==================== 领养状态 ====================

export const getAdoptionStatusConfig = (status: AdoptionStatus | number): StatusConfig => {
  const map: Record<number, StatusConfig> = {
    [AdoptionStatus.ACTIVE]: {
      label: '领养中',
      variant: 'success',
      color: 'text-green-600 bg-green-50'
    },
    [AdoptionStatus.REDEEMABLE]: {
      label: '可买断',
      variant: 'info',
      color: 'text-blue-600 bg-blue-50'
    },
    [AdoptionStatus.REDEMPTION_PENDING]: {
      label: '买断审核中',
      variant: 'warning',
      color: 'text-orange-600 bg-orange-50'
    },
    [AdoptionStatus.REDEEMED]: {
      label: '已买断',
      variant: 'default',
      color: 'text-slate-600 bg-slate-100'
    },
    [AdoptionStatus.TERMINATED]: {
      label: '已终止',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    },
    [AdoptionStatus.FEED_OVERDUE]: {
      label: '饲料费逾期',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    }
  };
  return map[status] || { label: '未知', variant: 'default', color: 'text-slate-500 bg-slate-100' };
};

// ==================== 饲料费账单状态 ====================

export const getFeedBillStatusConfig = (status: FeedBillStatus | number): StatusConfig => {
  const map: Record<number, StatusConfig> = {
    [FeedBillStatus.PENDING]: {
      label: '待缴纳',
      variant: 'warning',
      color: 'text-orange-600 bg-orange-50'
    },
    [FeedBillStatus.PAID]: {
      label: '已缴纳',
      variant: 'success',
      color: 'text-green-600 bg-green-50'
    },
    [FeedBillStatus.OVERDUE]: {
      label: '已逾期',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    },
    [FeedBillStatus.WAIVED]: {
      label: '已免除',
      variant: 'default',
      color: 'text-slate-500 bg-slate-100'
    }
  };
  return map[status] || { label: '未知', variant: 'default', color: 'text-slate-500 bg-slate-100' };
};

// ==================== 买断状态 ====================

export const getRedemptionStatusConfig = (status: RedemptionStatus | number): StatusConfig => {
  const map: Record<number, StatusConfig> = {
    [RedemptionStatus.PENDING_AUDIT]: {
      label: '待审核',
      variant: 'warning',
      color: 'text-orange-600 bg-orange-50'
    },
    [RedemptionStatus.AUDIT_PASSED]: {
      label: '待支付',
      variant: 'info',
      color: 'text-blue-600 bg-blue-50'
    },
    [RedemptionStatus.PAID]: {
      label: '已支付',
      variant: 'success',
      color: 'text-green-600 bg-green-50'
    },
    [RedemptionStatus.AUDIT_REJECTED]: {
      label: '审核拒绝',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    },
    [RedemptionStatus.CANCELLED]: {
      label: '已取消',
      variant: 'default',
      color: 'text-slate-500 bg-slate-100'
    }
  };
  return map[status] || { label: '未知', variant: 'default', color: 'text-slate-500 bg-slate-100' };
};

// ==================== 退款状态 ====================

export const getRefundStatusConfig = (status: RefundStatus | number): StatusConfig => {
  const map: Record<number, StatusConfig> = {
    [RefundStatus.PENDING_AUDIT]: {
      label: '待审核',
      variant: 'warning',
      color: 'text-orange-600 bg-orange-50'
    },
    [RefundStatus.AUDIT_PASSED]: {
      label: '审核通过',
      variant: 'info',
      color: 'text-blue-600 bg-blue-50'
    },
    [RefundStatus.REFUNDED]: {
      label: '已退款',
      variant: 'success',
      color: 'text-green-600 bg-green-50'
    },
    [RefundStatus.AUDIT_REJECTED]: {
      label: '审核拒绝',
      variant: 'danger',
      color: 'text-red-600 bg-red-50'
    },
    [RefundStatus.CANCELLED]: {
      label: '已取消',
      variant: 'default',
      color: 'text-slate-500 bg-slate-100'
    }
  };
  return map[status] || { label: '未知', variant: 'default', color: 'text-slate-500 bg-slate-100' };
};

// ==================== 便捷函数 ====================

/**
 * 获取领养状态的 Badge variant
 */
export const getAdoptionBadgeVariant = (status: AdoptionStatus | number): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
  return getAdoptionStatusConfig(status).variant;
};

/**
 * 获取领养状态文本
 */
export const getAdoptionStatusText = (status: AdoptionStatus | number): string => {
  return getAdoptionStatusConfig(status).label;
};

/**
 * 获取订单状态文本
 */
export const getOrderStatusText = (status: OrderStatus | number): string => {
  return getOrderStatusConfig(status).label;
};

/**
 * 获取饲料费账单状态文本
 */
export const getFeedBillStatusText = (status: FeedBillStatus | number): string => {
  return getFeedBillStatusConfig(status).label;
};
