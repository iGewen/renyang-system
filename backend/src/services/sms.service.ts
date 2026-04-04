import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsCode } from '@/entities';
import { CryptoUtil } from '@/common/utils/crypto.util';

/**
 * 阿里云短信服务
 * 文档：https://help.aliyun.com/document_detail/101414.html
 */
@Injectable()
export class SmsService {
  private accessKeyId: string;
  private accessKeySecret: string;
  private signName: string;
  private templateCode: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    @InjectRepository(SmsCode)
    private smsCodeRepository: Repository<SmsCode>,
  ) {
    this.accessKeyId = this.configService.get('aliyun.sms.accessKeyId') || '';
    this.accessKeySecret = this.configService.get('aliyun.sms.accessKeySecret') || '';
    this.signName = this.configService.get('aliyun.sms.signName') || '';
    this.templateCode = this.configService.get('aliyun.sms.templateCode') || '';
  }

  /**
   * 发送验证码
   */
  async sendVerificationCode(phone: string, type: string): Promise<{ success: boolean; code?: string }> {
    // 检查发送频率限制
    const limitKey = `sms:limit:${phone}`;
    const exists = await this.redisService.exists(limitKey);
    if (exists) {
      throw new BadRequestException('验证码发送过于频繁，请60秒后重试');
    }

    // 生成验证码
    const code = CryptoUtil.randomDigits(6);

    // 存储验证码到数据库
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    const smsCode = this.smsCodeRepository.create({
      phone,
      code,
      type,
      expireAt,
    });
    await this.smsCodeRepository.save(smsCode);

    // 存储验证码到Redis（用于快速验证）
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.set(codeKey, code, 300); // 5分钟

    // 设置发送频率限制
    await this.redisService.set(limitKey, '1', 60); // 60秒

    // 发送短信
    try {
      await this.sendSms(phone, code);
      return { success: true };
    } catch (error) {
      console.error('[SMS] 发送失败:', error);
      // 开发环境返回验证码
      if (this.configService.get('app.env') === 'development') {
        console.log(`[SMS] 开发模式 - 验证码: ${code}`);
        return { success: true, code };
      }
      throw new BadRequestException('短信发送失败，请稍后重试');
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone: string, code: string, type: string): Promise<boolean> {
    // 从Redis获取验证码
    const codeKey = `sms:code:${phone}:${type}`;
    const storedCode = await this.redisService.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('验证码已过期');
    }

    if (storedCode !== code) {
      throw new BadRequestException('验证码错误');
    }

    return true;
  }

  /**
   * 标记验证码已使用
   */
  async markCodeUsed(phone: string, code: string, type: string): Promise<void> {
    // 删除Redis中的验证码
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.del(codeKey);

    // 更新数据库中的验证码状态
    await this.smsCodeRepository.update(
      { phone, code, type, isUsed: 0 },
      { isUsed: 1 },
    );
  }

  /**
   * 发送短信（调用阿里云API）
   */
  private async sendSms(phone: string, code: string): Promise<void> {
    // 如果没有配置阿里云密钥，则跳过实际发送
    if (!this.accessKeyId || !this.accessKeySecret) {
      console.log(`[SMS] 模拟发送 - 手机: ${phone}, 验证码: ${code}`);
      return;
    }

    const params = {
      AccessKeyId: this.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: this.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Date.now().toString(),
      SignatureVersion: '1.0',
      TemplateCode: this.templateCode,
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25',
    };

    // 构建签名字符串
    const queryString = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key as keyof typeof params])}`)
      .join('&');

    const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;

    // 计算签名
    const signature = await this.hmacSha1(this.accessKeySecret + '&', stringToSign);

    // 发送请求
    const response = await fetch('https://dysmsapi.aliyuncs.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${queryString}&Signature=${encodeURIComponent(signature)}`,
    });

    const result = await response.json() as any;

    if (result.Code !== 'OK') {
      throw new Error(result.Message || '短信发送失败');
    }
  }

  /**
   * HMAC-SHA1签名
   */
  private async hmacSha1(key: string, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBuffer = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * 发送通知短信
   */
  async sendNotification(phone: string, templateCode: string, params: Record<string, string>): Promise<void> {
    if (!this.accessKeyId || !this.accessKeySecret) {
      console.log(`[SMS] 模拟发送通知 - 手机: ${phone}, 模板: ${templateCode}, 参数:`, params);
      return;
    }

    const smsParams = {
      AccessKeyId: this.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: this.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Date.now().toString(),
      SignatureVersion: '1.0',
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify(params),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25',
    };

    // 构建签名并发送（与验证码发送相同逻辑）
    const queryString = Object.keys(smsParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(smsParams[key as keyof typeof smsParams])}`)
      .join('&');

    const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;
    const signature = await this.hmacSha1(this.accessKeySecret + '&', stringToSign);

    const response = await fetch('https://dysmsapi.aliyuncs.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${queryString}&Signature=${encodeURIComponent(signature)}`,
    });

    const result = await response.json() as any;

    if (result.Code !== 'OK') {
      throw new Error(result.Message || '短信发送失败');
    }
  }
}
