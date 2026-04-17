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
   * AES加密 - 使用随机IV确保安全
   * 返回格式: iv:ciphertext（十六进制）
   */
  static aesEncrypt(text: string, key: string, iv?: string): string {
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
    // 安全修复：使用随机IV，确保相同明文产生不同密文
    const ivBuffer = iv
      ? Buffer.from(iv.padEnd(16, '0').substring(0, 16))
      : crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 返回 IV + 密文，解密时需要
    return ivBuffer.toString('hex') + ':' + encrypted;
  }

  /**
   * AES解密 - 支持新格式（iv:ciphertext）和旧格式（无IV）
   */
  static aesDecrypt(encrypted: string, key: string, iv?: string): string {
    const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));

    let ivBuffer: Buffer;
    let ciphertext: string;

    if (encrypted.includes(':')) {
      // 新格式：iv:ciphertext
      const parts = encrypted.split(':');
      ivBuffer = Buffer.from(parts[0], 'hex');
      ciphertext = parts[1];
    } else if (iv) {
      // 旧格式兼容：使用传入的IV
      ivBuffer = Buffer.from(iv.padEnd(16, '0').substring(0, 16));
      ciphertext = encrypted;
    } else {
      // 旧格式兼容：使用全零IV（不安全，仅用于解密旧数据）
      ivBuffer = Buffer.alloc(16, 0);
      ciphertext = encrypted;
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
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
