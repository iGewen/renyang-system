import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../../src/modules/order/order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, OrderStatus, Adoption, AdoptionStatus } from '../../src/entities';
import { RedisService } from '../../src/common/utils/redis.service';
import { LivestockService } from '../../src/modules/livestock/livestock.service';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;
  let mockOrderRepository: any;
  let mockAdoptionRepository: any;
  let mockRedisService: any;
  let mockLivestockService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      update: jest.fn(),
    };

    mockAdoptionRepository = {
      count: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockRedisService = {
      exists: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      setNX: jest.fn(),
      withLock: jest.fn((key, ttl, fn) => fn()),
      zadd: jest.fn(),
      zrem: jest.fn(),
    };

    mockLivestockService = {
      getById: jest.fn(),
      getStock: jest.fn(),
      updateStock: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn((fn) => fn({
        save: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockReturnValue({ id: 'ORD1', orderNo: 'ORD20240101001' }),
        findOne: jest.fn().mockResolvedValue({ id: 'L1', stock: 10, status: 1, price: 1000 }),
        createQueryBuilder: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Adoption),
          useValue: mockAdoptionRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: LivestockService,
          useValue: mockLivestockService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  describe('create', () => {
    it('应该创建订单成功', async () => {
      const mockLivestock = {
        id: 'L1',
        name: '小羊',
        price: 1000,
        status: 1,
        monthlyFeedFee: 100,
        redemptionMonths: 12,
      };

      mockRedisService.exists.mockResolvedValue(false);
      mockLivestockService.getById.mockResolvedValue(mockLivestock);

      const result = await service.create('U1', 'L1', 'CLIENT1');

      expect(result).toBeDefined();
    });

    it('应该抛出活体已售罄或已下架异常', async () => {
      // 库存检查在事务中，execute 返回 affected: 0
      mockDataSource.transaction = jest.fn((fn) => fn({
        save: jest.fn(),
        create: jest.fn().mockReturnValue({ id: 'ORD1' }),
        findOne: jest.fn().mockResolvedValue({ id: 'L1', stock: 0, status: 2, price: 1000 }),
        createQueryBuilder: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }), // 库存不足或已下架
      }));

      mockRedisService.exists.mockResolvedValue(false);

      await expect(service.create('U1', 'L1', 'CLIENT1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('应该取消订单成功', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        id: 'ORD1',
        userId: 'U1',
        status: OrderStatus.PENDING_PAYMENT,
        clientOrderId: 'CLIENT1',
      });
      mockOrderRepository.save.mockResolvedValue({});

      const result = await service.cancel('U1', 'ORD1');

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('应该抛出订单不存在异常', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.cancel('U1', 'ORD1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('应该抛出订单状态不允许取消异常', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        id: 'ORD1',
        userId: 'U1',
        status: OrderStatus.PAID,
      });

      await expect(service.cancel('U1', 'ORD1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getById', () => {
    it('应该返回订单详情', async () => {
      const mockOrder = {
        id: 'ORD1',
        orderNo: 'ORD20240101001',
        status: OrderStatus.PAID,
      };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      // 使用公共方法 getByIdForUser 而非私有方法 getById
      const result = await service.getByIdForUser('ORD1', 'U1');

      expect(result).toEqual(mockOrder);
    });
  });
});
