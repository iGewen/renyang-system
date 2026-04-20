import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成唯一ID
 * 修复 F-079：使用 crypto.randomUUID 替代 Math.random()
 */
export const generateId = (prefix: string) => {
  // 使用密码学安全的 UUID 生成器
  return `${prefix}${crypto.randomUUID().replace(/-/g, '').substring(0, 9).toUpperCase()}`;
};
