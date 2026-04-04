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
        save: jest.fn(),
        create: jest.fn(),
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
      mockLivestockService.getStock.mockResolvedValue(10);
      mockOrderRepository.create.mockReturnValue({
        id: 'ORD1',
        orderNo: 'ORD20240101001',
      });
      mockOrderRepository.save.mockResolvedValue({});

      const result = await service.create('U1', 'L1', 'CLIENT1');

      expect(result).toBeDefined();
    });

    it('应该抛出库存不足异常', async () => {
      const mockLivestock = {
        id: 'L1',
        name: '小羊',
        price: 1000,
        status: 1,
      };

      mockRedisService.exists.mockResolvedValue(false);
      mockLivestockService.getById.mockResolvedValue(mockLivestock);
      mockLivestockService.getStock.mockResolvedValue(0);

      await expect(service.create('U1', 'L1', 'CLIENT1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('应该抛出活体已下架异常', async () => {
      const mockLivestock = {
        id: 'L1',
        name: '小羊',
        price: 1000,
        status: 2,
      };

      mockRedisService.exists.mockResolvedValue(false);
      mockLivestockService.getById.mockResolvedValue(mockLivestock);

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

      const result = await service.getById('ORD1', 'U1');

      expect(result).toEqual(mockOrder);
    });
  });
});
