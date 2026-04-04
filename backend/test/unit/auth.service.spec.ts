import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../src/entities/user.entity';
import { SmsCode } from '../../src/entities/sms-code.entity';
import { RedisService } from '../../src/common/utils/redis.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepository: any;
  let mockSmsCodeRepository: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRedisService: any;

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      update: jest.fn(),
    };

    mockSmsCodeRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('test-token'),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-value'),
    };

    mockRedisService = {
      exists: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(SmsCode),
          useValue: mockSmsCodeRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('sendSmsCode', () => {
    it('应该发送验证码成功', async () => {
      mockRedisService.exists.mockResolvedValue(false);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockSmsCodeRepository.create.mockReturnValue({});
      mockSmsCodeRepository.save.mockResolvedValue({});

      const result = await service.sendSmsCode({
        phone: '13800138000',
        type: 'register',
      });

      expect(result).toEqual({ success: true });
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('应该抛出发送频率限制异常', async () => {
      mockRedisService.exists.mockResolvedValue(true);

      await expect(
        service.sendSmsCode({ phone: '13800138000', type: 'register' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该抛出手机号已注册异常', async () => {
      mockRedisService.exists.mockResolvedValue(false);
      mockUserRepository.findOne.mockResolvedValue({ id: '1', phone: '13800138000' });

      await expect(
        service.sendSmsCode({ phone: '13800138000', type: 'register' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    it('应该注册成功', async () => {
      mockRedisService.get.mockResolvedValue('123456');
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        id: 'U123',
        phone: '13800138000',
      });
      mockUserRepository.save.mockResolvedValue({});
      mockSmsCodeRepository.update.mockResolvedValue({});

      const result = await service.register({
        phone: '13800138000',
        code: '123456',
        password: 'password123',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('应该抛出验证码错误异常', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.register({
          phone: '13800138000',
          code: '123456',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginByPassword', () => {
    it('应该登录成功', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.createQueryBuilder.mockReturnThis();
      mockUserRepository.where.mockReturnThis();
      mockUserRepository.addSelect.mockReturnThis();
      mockUserRepository.getOne.mockResolvedValue({
        id: 'U123',
        phone: '13800138000',
        password: hashedPassword,
        status: 1,
      });
      mockUserRepository.update.mockResolvedValue({});

      const result = await service.loginByPassword({
        phone: '13800138000',
        password: 'password123',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('应该抛出用户不存在异常', async () => {
      mockUserRepository.createQueryBuilder.mockReturnThis();
      mockUserRepository.where.mockReturnThis();
      mockUserRepository.addSelect.mockReturnThis();
      mockUserRepository.getOne.mockResolvedValue(null);

      await expect(
        service.loginByPassword({
          phone: '13800138000',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该抛出密码错误异常', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.createQueryBuilder.mockReturnThis();
      mockUserRepository.where.mockReturnThis();
      mockUserRepository.addSelect.mockReturnThis();
      mockUserRepository.getOne.mockResolvedValue({
        id: 'U123',
        phone: '13800138000',
        password: hashedPassword,
        status: 1,
      });

      await expect(
        service.loginByPassword({
          phone: '13800138000',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
