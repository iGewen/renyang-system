import * as crypto from 'crypto';

export class CryptoUtil {
  /**
   * MD5加密
   */
  static md5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * SHA256加密
   */
  static sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * AES加密
   */
  static aesEncrypt(text: string, key: string, iv?: string): string {
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
    const ivBuffer = iv ? Buffer.from(iv.padEnd(16, '0').substring(0, 16)) : Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * AES解密
   */
  static aesDecrypt(encrypted: string, key: string, iv?: string): string {
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
    const ivBuffer = iv ? Buffer.from(iv.padEnd(16, '0').substring(0, 16)) : Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 生成随机字符串
   */
  static randomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  /**
   * 生成随机数字字符串
   */
  static randomDigits(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
}
