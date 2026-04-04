import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, BalanceLog } from '../../src/entities';

describe('BalanceService', () => {
  let service: BalanceService;
  let mockUserRepository: any;
  let mockBalanceLogRepository: any;

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockBalanceLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(BalanceLog),
          useValue: mockBalanceLogRepository,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  describe('getBalance', () => {
    it('应该返回用户余额', async () => {
      const mockUser = {
        id: 'U1',
        balance: 1000,
        nickname: '测试用户',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getBalance('U1');

      expect(result.balance).toBe(1000);
      expect(result.user).toEqual(mockUser);
    });

    it('用户不存在应该抛出异常', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getBalance('U1')).rejects.toThrow('用户不存在');
    });
  });

  describe('getBalanceLogs', () => {
    it('应该返回余额变动记录', async () => {
      const mockLogs = [
        { id: 'BL1', amount: 100, type: 1 },
        { id: 'BL2', amount: -50, type: 2 },
      ];
      mockBalanceLogRepository.findAndCount.mockResolvedValue([mockLogs, 2]);

      const result = await service.getBalanceLogs('U1', 1, 10);

      expect(result.list).toEqual(mockLogs);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });
});
