import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (prefix: string) => {
  // 使用 substring 替代已废弃的 substr
  return `${prefix}${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
};
