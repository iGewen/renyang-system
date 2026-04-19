import * as crypto from 'crypto';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      db: this.configService.get('redis.db'),
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * 设置值
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * 自增
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * 自减
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /**
   * 哈希 - 设置字段
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  /**
   * 哈希 - 获取字段
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * 哈希 - 获取所有
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * 哈希 - 删除字段
   */
  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(key, ...fields);
  }

  /**
   * 有序集合 - 添加成员
   */
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  /**
   * 有序集合 - 获取范围内的成员
   */
  async zrangebyscore(key: string, min: number, max: number, limit?: number): Promise<string[]> {
    if (limit) {
      return this.client.zrangebyscore(key, min, max, 'LIMIT', 0, limit);
    }
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * 有序集合 - 删除成员
   */
  async zrem(key: string, member: string): Promise<void> {
    await this.client.zrem(key, member);
  }

  /**
   * 设置值（仅在键不存在时）
   */
  async setNX(key: string, value: string, ttl?: number): Promise<boolean> {
    if (ttl) {
      const result = await this.client.set(key, value, 'EX', ttl, 'NX');
      return result === 'OK';
    }
    const result = await this.client.setnx(key, value);
    return result === 1;
  }

  /**
   * 分布式锁 - 获取锁
   */
  async acquireLock(key: string, ttl: number = 30000): Promise<boolean> {
    const result = await this.client.set(key, '1', 'PX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * 分布式锁 - 获取锁（带唯一标识）
   * 使用密码学安全的随机数生成器
   */
  async acquireLockWithValue(key: string, ttl: number = 30000): Promise<string | null> {
    const value = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    const result = await this.client.set(key, value, 'PX', ttl, 'NX');
    return result === 'OK' ? value : null;
  }

  /**
   * 分布式锁 - 释放锁（只释放自己持有的锁）
   * 使用 Lua 脚本确保原子性
   */
  async releaseLock(key: string, value?: string): Promise<boolean> {
    if (!value) {
      // 兼容旧调用方式，直接删除
      await this.client.del(key);
      return true;
    }

    // Lua 脚本：只有当锁的值匹配时才删除
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, key, value);
    return result === 1;
  }

  /**
   * 使用锁执行任务（安全版本）
   */
  async withLock<T>(key: string, ttl: number, task: () => Promise<T>): Promise<T> {
    const lockValue = await this.acquireLockWithValue(key, ttl);
    if (!lockValue) {
      throw new Error('获取锁失败，请稍后重试');
    }
    try {
      return await task();
    } finally {
      await this.releaseLock(key, lockValue);
    }
  }
}
