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
   * 获取当前时间的 YYMMDDHHmmss 格式
   */
  private static getTimestamp(): string {
    const date = new Date();
    const year = String(date.getFullYear()).substring(2); // YY
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * 生成订单号
   * 格式：ORD + YYMMDDHHmmss
   */
  static generateOrderNo(): string {
    return `ORD${this.getTimestamp()}`;
  }

  /**
   * 生成支付单号
   * 格式：PAY + YYMMDDHHmmss
   */
  static generatePaymentNo(): string {
    return `PAY${this.getTimestamp()}`;
  }

  /**
   * 生成活体编号（领养编号）
   * 格式：HT + YYMMDDHHmmss
   * 注：活体编号 = 领养编号，一个活体只能被一个人领养
   */
  static generateLivestockNo(): string {
    return `HT${this.getTimestamp()}`;
  }

  /**
   * 生成领养编号（已废弃，使用 generateLivestockNo）
   * @deprecated 使用 generateLivestockNo 替代
   */
  static generateAdoptionNo(): string {
    return this.generateLivestockNo();
  }

  /**
   * 生成账单编号
   * 格式：BILL + YYMMDDHHmmss
   */
  static generateBillNo(): string {
    return `BILL${this.getTimestamp()}`;
  }

  /**
   * 生成买断编号
   * 格式：MD + YYMMDDHHmmss
   */
  static generateRedemptionNo(): string {
    return `MD${this.getTimestamp()}`;
  }

  /**
   * 生成退款编号
   * 格式：RFD + YYMMDDHHmmss
   */
  static generateRefundNo(): string {
    return `RFD${this.getTimestamp()}`;
  }
}
