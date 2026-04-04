import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (prefix: string) => {
  return `${prefix}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};
