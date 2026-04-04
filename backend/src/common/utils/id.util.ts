import { v4 as uuidv4 } from 'uuid';

export class IdUtil {
  /**
   * 生成带前缀的ID
   */
  static generate(prefix: string): string {
    const uuid = uuidv4().replace(/-/g, '').toUpperCase();
    return `${prefix}${uuid.substring(0, 12)}`;
  }

  /**
   * 生成订单号
   */
  static generateOrderNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD${year}${month}${day}${random}`;
  }

  /**
   * 生成支付单号
   */
  static generatePaymentNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `PAY${year}${month}${day}${random}`;
  }

  /**
   * 生成领养编号
   */
  static generateAdoptionNo(): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ADPT${random}`;
  }

  /**
   * 生成账单编号
   */
  static generateBillNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BILL${year}${month}${random}`;
  }

  /**
   * 生成买断编号
   */
  static generateRedemptionNo(): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RDM${random}`;
  }

  /**
   * 生成退款编号
   */
  static generateRefundNo(): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RFD${random}`;
  }
}
