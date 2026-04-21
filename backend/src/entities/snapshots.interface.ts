/**
 * 活体快照类型定义
 * 用于订单和领养记录中保存当时的活体信息
 */
export interface LivestockSnapshot {
  id: string;
  name: string;
  price: number;
  monthlyFeedFee: number;
  redemptionMonths: number;
  description?: string;
  images?: string[];
  mainImage?: string;
  typeId?: string;
  typeName?: string;
}

/**
 * 支付回调数据类型定义
 */
export interface PaymentNotifyData {
  out_trade_no?: string;
  transaction_id?: string;
  trade_status?: string;
  total_amount?: string;
  trade_no?: string;
  notify_id?: string;
  // 微信特有字段
  trade_state?: string;
  amount?: {
    total: number;
    currency?: string;
  };
}

/**
 * 请求用户信息类型定义
 */
export interface RequestUser {
  id: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  balance?: number;
  status?: number;
  type: 'user' | 'admin';
  role?: string;
  username?: string;
}
