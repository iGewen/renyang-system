import { Test, TestingModule } from '@nestjs/testing';
import { OrderStateService } from './order-state.service';
import { OrderStatus, Order, OrderHistory } from '@/entities';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '@/common/utils/redis.service';
import { canTransition } from './order-state.config';
import { DataSource } from 'typeorm';

describe('OrderStateService', () => {
  let service: OrderStateService;
  let redisService: jest.Mocked<RedisService>;
  let orderRepository: jest.Mocked<any>;
  let historyRepository: jest.Mocked<any>;

  const mockOrder = {
    id: 'ORD123',
    status: OrderStatus.PAID,
    userId: 'U123',
  };

  beforeEach(async () => {
    jest.clearAllMocks(); // 清除所有 mock 调用记录

    const mockRedisService = {
      withLock: jest.fn((key: string, ttl: number, callback: () => Promise<any>) => callback()),
    };

    const mockOrderRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockHistoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStateService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        { provide: getRepositoryToken(OrderHistory), useValue: mockHistoryRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrderStateService>(OrderStateService);
    redisService = module.get(RedisService);
    orderRepository = module.get(getRepositoryToken(Order));
    historyRepository = module.get(getRepositoryToken(OrderHistory));
  });

  describe('canTransition (状态转换规则)', () => {
    // 正向转换
    it('允许 PAID -> REFUND_REVIEW (用户申请退款)', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.REFUND_REVIEW)).toBe(true);
    });

    it('允许 REFUND_REVIEW -> REFUND_PROCESSING (审核通过)', () => {
      expect(canTransition(OrderStatus.REFUND_REVIEW, OrderStatus.REFUND_PROCESSING)).toBe(true);
    });

    it('允许 REFUND_PROCESSING -> REFUNDED (退款成功)', () => {
      expect(canTransition(OrderStatus.REFUND_PROCESSING, OrderStatus.REFUNDED)).toBe(true);
    });

    it('允许 REFUND_FAILED -> REFUND_PROCESSING (重试)', () => {
      expect(canTransition(OrderStatus.REFUND_FAILED, OrderStatus.REFUND_PROCESSING)).toBe(true);
    });

    it('允许 PENDING_PAYMENT -> PAID (支付成功)', () => {
      expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(true);
    });

    it('允许 PENDING_PAYMENT -> CANCELLED (超时取消)', () => {
      expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED)).toBe(true);
    });

    it('允许 REFUND_REVIEW -> PAID (审核拒绝，恢复)', () => {
      expect(canTransition(OrderStatus.REFUND_REVIEW, OrderStatus.PAID)).toBe(true);
    });

    // 非法转换
    it('禁止 PAID -> REFUNDED (必须经过 REFUND_REVIEW)', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(false);
    });

    it('禁止 CANCELLED -> 任何状态 (终态)', () => {
      expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
      expect(canTransition(OrderStatus.CANCELLED, OrderStatus.REFUNDED)).toBe(false);
    });

    it('禁止 REFUNDED -> 任何状态 (终态)', () => {
      expect(canTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
      expect(canTransition(OrderStatus.REFUNDED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('禁止 ADMIN_CANCELLED -> 任何状态 (终态)', () => {
      expect(canTransition(OrderStatus.ADMIN_CANCELLED, OrderStatus.PAID)).toBe(false);
    });

    it('禁止 REFUND_PROCESSING -> PAID (不能回退)', () => {
      expect(canTransition(OrderStatus.REFUND_PROCESSING, OrderStatus.PAID)).toBe(false);
    });
  });

  describe('transition (状态转换执行)', () => {
    // 先测试状态相同时的情况（不受其他测试影响）
    it('状态相同时不做转换', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.transition('ORD123', OrderStatus.PAID, { id: 'admin1', type: 'admin' });

      expect(orderRepository.save).not.toHaveBeenCalled();
      expect(historyRepository.save).not.toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('成功从 PAID 转换到 REFUND_REVIEW', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      orderRepository.save.mockResolvedValue({ ...mockOrder, status: OrderStatus.REFUND_REVIEW });
      historyRepository.create.mockReturnValue({});
      historyRepository.save.mockResolvedValue({});

      await service.transition('ORD123', OrderStatus.REFUND_REVIEW, {
        id: 'admin1',
        type: 'admin',
      }, '用户申请退款');

      expect(orderRepository.findOne).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(historyRepository.save).toHaveBeenCalled();
    });

    it('订单不存在时抛出错误', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.transition('ORD999', OrderStatus.REFUND_REVIEW, { id: 'admin1', type: 'admin' })
      ).rejects.toThrow('订单不存在');
    });

    it('非法转换时抛出错误', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.transition('ORD123', OrderStatus.REFUNDED, { id: 'admin1', type: 'admin' })
      ).rejects.toThrow('不允许');
    });

    it('转换前获取分布式锁', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      orderRepository.save.mockResolvedValue({ ...mockOrder, status: OrderStatus.REFUND_REVIEW });
      historyRepository.create.mockReturnValue({});
      historyRepository.save.mockResolvedValue({});

      await service.transition('ORD123', OrderStatus.REFUND_REVIEW, { id: 'admin1', type: 'admin' });

      expect(redisService.withLock).toHaveBeenCalledWith(
        'order:lock:ORD123',
        10,
        expect.any(Function)
      );
    });
  });
});
