import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

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
   * 生成随机后缀（密码学安全）
   * 确保同一秒内生成的 ID 也是唯一的
   */
  private static getRandomSuffix(length: number = 4): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length).toUpperCase();
  }

  /**
   * 生成订单号
   * 格式：ORD + YYMMDDHHmmss + 随机后缀
   */
  static generateOrderNo(): string {
    return `ORD${this.getTimestamp()}${this.getRandomSuffix()}`;
  }

  /**
   * 生成支付单号
   * 格式：PAY + YYMMDDHHmmss + 随机后缀
   */
  static generatePaymentNo(): string {
    return `PAY${this.getTimestamp()}${this.getRandomSuffix()}`;
  }

  /**
   * 生成活体编号（领养编号）
   * 格式：HT + YYMMDDHHmmss + 随机后缀
   * 注：活体编号 = 领养编号，一个活体只能被一个人领养
   */
  static generateLivestockNo(): string {
    return `HT${this.getTimestamp()}${this.getRandomSuffix()}`;
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
   * 格式：BILL + YYMMDDHHmmss + 随机后缀
   */
  static generateBillNo(): string {
    return `BILL${this.getTimestamp()}${this.getRandomSuffix()}`;
  }

  /**
   * 生成买断编号
   * 格式：MD + YYMMDDHHmmss + 随机后缀
   */
  static generateRedemptionNo(): string {
    return `MD${this.getTimestamp()}${this.getRandomSuffix()}`;
  }

  /**
   * 生成退款编号
   * 格式：RFD + YYMMDDHHmmss + 随机后缀
   */
  static generateRefundNo(): string {
    return `RFD${this.getTimestamp()}${this.getRandomSuffix()}`;
  }
}
