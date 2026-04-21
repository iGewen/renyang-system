/**
 * 分页工具常量和函数
 * 安全修复 S-09：防止分页参数过大导致内存溢出
 */

/**
 * 分页相关常量
 */
export const PAGINATION = {
  /** 默认页码 */
  DEFAULT_PAGE: 1,
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: 20,
  /** 每页最大数量 */
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * 标准化分页参数
 * 确保页码和每页数量在合理范围内
 *
 * @param page - 页码（从1开始）
 * @param pageSize - 每页数量
 * @returns 标准化后的分页参数
 */
export function normalizePagination(
  page?: number,
  pageSize?: number,
): { page: number; pageSize: number; skip: number } {
  const normalizedPage = Math.max(PAGINATION.DEFAULT_PAGE, Math.floor(Number(page) || PAGINATION.DEFAULT_PAGE));
  const normalizedPageSize = Math.min(
    PAGINATION.MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(pageSize) || PAGINATION.DEFAULT_PAGE_SIZE)),
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
  };
}

/**
 * 计算总页数
 */
export function calculateTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * 构建分页返回结果
 */
export function buildPaginationResult<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: calculateTotalPages(total, pageSize),
  };
}
