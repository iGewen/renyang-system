import { Test, TestingModule } from '@nestjs/testing';
import { LivestockService } from '../../src/modules/livestock/livestock.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Livestock, LivestockType } from '../../src/entities';
import { RedisService } from '../../src/common/utils/redis.service';

describe('LivestockService', () => {
  let service: LivestockService;
  let mockLivestockRepository: any;
  let mockLivestockTypeRepository: any;
  let mockRedisService: any;

  beforeEach(async () => {
    mockLivestockRepository = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    mockLivestockTypeRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivestockService,
        {
          provide: getRepositoryToken(Livestock),
          useValue: mockLivestockRepository,
        },
        {
          provide: getRepositoryToken(LivestockType),
          useValue: mockLivestockTypeRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<LivestockService>(LivestockService);
  });

  describe('getTypes', () => {
    it('应该返回活体类型列表', async () => {
      const mockTypes = [
        { id: '1', name: '羊', status: 1 },
        { id: '2', name: '牛', status: 1 },
      ];
      mockLivestockTypeRepository.find.mockResolvedValue(mockTypes);

      const result = await service.getTypes();

      expect(result).toEqual(mockTypes);
      expect(mockLivestockTypeRepository.find).toHaveBeenCalledWith({
        where: { status: 1 },
        order: { sortOrder: 'ASC' },
      });
    });
  });

  describe('getList', () => {
    it('应该返回活体分页列表', async () => {
      const mockLivestock = [
        { id: 'L1', name: '小羊', type: { name: '羊' } },
        { id: 'L2', name: '小牛', type: { name: '牛' } },
      ];
      mockLivestockRepository.getManyAndCount.mockResolvedValue([mockLivestock, 2]);

      const result = await service.getList({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty('list');
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize', 10);
    });
  });

  describe('getById', () => {
    it('应该返回活体详情', async () => {
      const mockLivestock = {
        id: 'L1',
        name: '小羊',
        type: { name: '羊' },
      };
      mockLivestockRepository.findOne.mockResolvedValue(mockLivestock);

      const result = await service.getById('L1');

      expect(result).toEqual(mockLivestock);
    });
  });

  describe('getStock', () => {
    it('应该从缓存返回库存', async () => {
      mockRedisService.get.mockResolvedValue('10');

      const result = await service.getStock('L1');

      expect(result).toBe(10);
    });

    it('应该从数据库获取库存并缓存', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockLivestockRepository.findOne.mockResolvedValue({ id: 'L1', stock: 20 });
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.getStock('L1');

      expect(result).toBe(20);
      expect(mockRedisService.set).toHaveBeenCalledWith('livestock:stock:L1', '20');
    });
  });

  describe('updateStock', () => {
    it('应该更新库存', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      mockLivestockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockLivestockRepository.findOne.mockResolvedValue({ id: 'L1', stock: 11 });
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.updateStock('L1', 1);

      expect(result).toBe(true);
    });
  });
});
