/**
 * 条件日志工具
 * 仅在开发环境输出日志，生产环境静默
 */

// Vite 环境变量 - 使用类型断言避免类型错误
const isDev = (import.meta as any).env?.DEV ?? false;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    // 错误始终记录，但可以使用错误追踪服务替代
    if (isDev) {
      console.error(...args);
    }
    // 生产环境可以集成 Sentry 等错误追踪服务
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};

export default logger;
