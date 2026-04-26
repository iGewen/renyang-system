import React, { useState, useEffect } from 'react';
import { Icons } from '../../../components/ui';

// 状态标签变体类型
export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

// 详情标签类型
export type DetailTab = 'orders' | 'payments' | 'balance' | 'adoptions';

// 领养状态辅助函数
export const getAdoptionStatusText = (status: number): string => {
  const map: Record<number, string> = {
    1: '领养中',
    2: '饲料费逾期',
    3: '异常',
    4: '可买断',
    5: '买断审核中',
    6: '已买断',
    7: '已终止',
  };
  return map[status] || '未知';
};

export const getAdoptionBadgeVariant = (status: number): StatusVariant => {
  if (status === 1) return 'success';      // 领养中
  if (status === 2 || status === 3) return 'danger'; // 逾期/异常
  if (status === 4) return 'info';         // 可买断
  if (status === 5) return 'warning';      // 买断审核中
  return 'default';
};

// 订单状态辅助函数
export const getOrderBadgeVariant = (status: number): StatusVariant => {
  if (status === 2) return 'success';    // PAID
  if (status === 1) return 'warning';    // PENDING_PAYMENT
  if (status === 4 || status === 6 || status === 7) return 'danger'; // REFUNDED, REFUND_PROCESSING, REFUND_FAILED
  return 'default';
};

export const getOrderStatusText = (status: number): string => {
  const map: Record<number, string> = {
    1: '待支付',
    2: '已支付',
    3: '已取消',
    4: '已退款',
    5: '退款审核中',
    6: '退款处理中',
    7: '退款失败',
    8: '已强制取消',
  };
  return map[status] || '未知';
};

// 支付状态辅助函数
export const getPaymentBadgeVariant = (status: number): StatusVariant => {
  if (status === 2) return 'success';    // SUCCESS
  if (status === 1) return 'warning';    // PENDING
  if (status === 3) return 'danger';     // FAILED
  return 'default';
};

export const getPaymentStatusText = (status: number): string => {
  const map: Record<number, string> = {
    1: '待支付',
    2: '支付成功',
    3: '支付失败',
    4: '已关闭',
  };
  return map[status] || '未知';
};

// 支付方式辅助函数
export const getPaymentMethodText = (method: string): string => {
  if (method === 'alipay') return '支付宝';
  if (method === 'wechat') return '微信';
  if (method === 'balance') return '余额';
  return method;
};

// 防抖 Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 敏感文本区域组件
export const SensitiveTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 4 }) => {
  const [visible, setVisible] = useState(false);

  const maskValue = (val: string) => {
    if (!val || val.length === 0) return '';
    if (val.length <= 8) return '••••••••';
    return val.substring(0, 4) + '••••••••' + val.substring(val.length - 4);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="text-xs text-brand-primary hover:underline flex items-center gap-1"
        >
          {visible ? (
            <>
              <Icons.EyeOff className="w-3.5 h-3.5" /> 隐藏
            </>
          ) : (
            <>
              <Icons.Eye className="w-3.5 h-3.5" /> 显示
            </>
          )}
        </button>
      </div>
      {visible ? (
        <textarea
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none font-mono text-xs"
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 overflow-hidden"
          style={{ minHeight: `${rows * 24 + 24}px` }}
        >
          {maskValue(value) || placeholder || '••••••••'}
        </div>
      )}
    </div>
  );
};
