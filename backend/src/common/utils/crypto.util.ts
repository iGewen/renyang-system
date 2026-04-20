import * as crypto from 'node:crypto';

export class CryptoUtil {
  /**
   * SHA256加密
   */
  static sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * AES加密 - 使用 AES-256-GCM（已认证加密）
   * 安全修复 B-SEC-001/B-SEC-003：使用 GCM 模式提供完整性保护
   * 返回格式: iv:authTag:ciphertext（十六进制）
   */
  static aesEncrypt(text: string, key: string): string {
    // 安全修复 B-SEC-001：强制要求32字节密钥，不再使用弱填充
    const keyBuffer = Buffer.from(key, 'utf8');
    if (keyBuffer.length !== 32) {
      throw new Error(`AES密钥长度必须为32字节，当前: ${keyBuffer.length}字节。请检查 ENCRYPTION_KEY 环境变量。`);
    }

    // 使用随机IV，确保相同明文产生不同密文
    const ivBuffer = crypto.randomBytes(16);

    // 使用 GCM 模式，提供认证加密（完整性保护）
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签（用于验证密文完整性）
    const authTag = cipher.getAuthTag().toString('hex');

    // 返回 IV + AuthTag + 密文，解密时需要
    return ivBuffer.toString('hex') + ':' + authTag + ':' + encrypted;
  }

  /**
   * AES解密 - 支持 GCM 模式（新格式）和 CBC 模式（旧格式兼容）
   */
  static aesDecrypt(encrypted: string, key: string, iv?: string): string {
    // 安全修复 B-SEC-001：强制要求32字节密钥
    const keyBuffer = Buffer.from(key, 'utf8');
    if (keyBuffer.length !== 32) {
      throw new Error(`AES密钥长度必须为32字节，当前: ${keyBuffer.length}字节。请检查 ENCRYPTION_KEY 环境变量。`);
    }

    const parts = encrypted.split(':');

    // 新格式 GCM: iv:authTag:ciphertext（3部分）
    if (parts.length === 3 && parts[1].length === 32) {
      const ivBuffer = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    // 旧格式 CBC 兼容：iv:ciphertext（2部分）或纯密文
    let ivBuffer: Buffer;
    let ciphertext: string;

    if (parts.length === 2) {
      // 旧格式：iv:ciphertext
      ivBuffer = Buffer.from(parts[0], 'hex');
      ciphertext = parts[1];
    } else if (iv) {
      // 使用传入的IV
      ivBuffer = Buffer.from(iv.padEnd(16, '0').substring(0, 16));
      ciphertext = encrypted;
    } else {
      // 无IV，使用全零（不安全，仅用于解密旧数据）
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
   * 生成随机数字字符串（密码学安全）
   */
  static randomDigits(length: number = 6): string {
    const digits: string[] = [];
    for (let i = 0; i < length; i++) {
      // 使用密码学安全的随机数生成器
      digits.push(crypto.randomInt(0, 10).toString());
    }
    return digits.join('');
  }
}
