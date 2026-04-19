/**
 * 日期格式化工具函数
 */

/**
 * 格式化日期为本地化字符串
 * @param dateStr 日期字符串或Date对象
 * @returns 格式化后的日期字符串 (YYYY/MM/DD HH:mm)
 */
export const formatDate = (dateStr: string | Date): string => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 格式化日期为简短格式
 * @param dateStr 日期字符串或Date对象
 * @returns 格式化后的日期字符串 (MM/DD)
 */
export const formatDateShort = (dateStr: string | Date): string => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * 格式化日期为完整格式
 * @param dateStr 日期字符串或Date对象
 * @returns 格式化后的日期字符串 (YYYY年MM月DD日 HH:mm:ss)
 */
export const formatDateFull = (dateStr: string | Date): string => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * 计算相对时间
 * @param dateStr 日期字符串或Date对象
 * @returns 相对时间描述 (如: "刚刚", "5分钟前", "昨天")
 */
export const formatRelativeTime = (dateStr: string | Date): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return '刚刚';
  } else if (diffMin < 60) {
    return `${diffMin}分钟前`;
  } else if (diffHour < 24) {
    return `${diffHour}小时前`;
  } else if (diffDay < 7) {
    return `${diffDay}天前`;
  } else {
    return formatDate(dateStr);
  }
};

/**
 * 格式化金额
 * @param amount 金额数字
 * @returns 格式化后的金额字符串
 */
export const formatAmount = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};
