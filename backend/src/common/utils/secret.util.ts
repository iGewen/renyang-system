import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

/**
 * Docker Secrets 读取工具
 * 安全修复 (I-C04): 优先从 Docker secret 文件读取敏感配置
 *
 * 自动化特性：
 * - 优先读取 Docker secret 文件
 * - 回退到环境变量（向后兼容）
 * - 开发环境可自动生成临时密钥（仅限非生产环境）
 *
 * 使用方式：
 * 1. 在 docker-compose.yml 中配置 secrets
 * 2. 环境变量使用 _FILE 后缀指向 secret 文件路径
 * 3. 此工具会优先读取 secret 文件，失败则回退到环境变量
 */
export class SecretUtil {
  private static readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * 读取敏感配置值
   * @param key 环境变量名称（不含 _FILE 后缀）
   * @returns secret 文件内容或环境变量值
   *
   * @example
   * // 环境变量: JWT_SECRET_FILE=/run/secrets/jwt_secret
   * // 或: JWT_SECRET=your-secret
   * const secret = SecretUtil.read('JWT_SECRET');
   */
  static read(key: string): string | undefined {
    // 优先从 _FILE 后缀的文件读取
    const filePath = process.env[`${key}_FILE`];
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, 'utf8').trim();
        }
      } catch (error) {
        // 文件读取失败，回退到环境变量
        console.warn(`[SecretUtil] Failed to read secret file ${filePath}: ${error}`);
      }
    }
    // 回退到环境变量
    return process.env[key];
  }

  /**
   * 读取敏感配置值，如果不存在则：
   * - 生产环境：抛出错误
   * - 开发环境：自动生成临时密钥
   * @param key 环境变量名称
   * @param minLength 最小长度（可选）
   * @returns secret 值
   */
  static readOrThrow(key: string, minLength?: number): string {
    let value = this.read(key);

    // 开发环境自动生成临时密钥
    if (!value && !this.isProduction) {
      value = this.generateTempSecret(minLength || 32);
      console.warn(`[SecretUtil] ${key} 未配置，开发环境自动生成临时密钥`);
      // 设置到环境变量，避免重复生成
      process.env[key] = value;
    }

    if (!value) {
      throw new Error(`${key} 未配置，请设置环境变量或 Docker secret`);
    }
    if (minLength && value.length < minLength) {
      throw new Error(`${key} 长度必须至少 ${minLength} 位，当前长度: ${value.length}`);
    }
    return value;
  }

  /**
   * 生成临时密钥（仅用于开发环境）
   */
  private static generateTempSecret(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
  }

  /**
   * 检查是否使用 Docker Secrets
   */
  static isUsingSecrets(): boolean {
    const secretKeys = ['JWT_SECRET', 'DB_PASSWORD', 'REDIS_PASSWORD', 'ENCRYPTION_KEY'];
    return secretKeys.some(key => !!process.env[`${key}_FILE`]);
  }
}
