import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Livestock, LivestockType } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Injectable()
export class LivestockService {
  constructor(
    @InjectRepository(Livestock)
    private readonly livestockRepository: Repository<Livestock>,
    @InjectRepository(LivestockType)
    private readonly livestockTypeRepository: Repository<LivestockType>,
    private readonly redisService: RedisService,
  ) {}

  async getTypes() {
    return this.livestockTypeRepository.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC' },
    });
  }

  async getList(options: { typeId?: string; status?: number; page?: number; pageSize?: number }) {
    const { typeId, status = 1, page = 1, pageSize = 10 } = options;

    const queryBuilder = this.livestockRepository.createQueryBuilder('livestock')
      .leftJoinAndSelect('livestock.type', 'type');

    if (typeId) {
      queryBuilder.andWhere('livestock.typeId = :typeId', { typeId });
    }

    if (status) {
      queryBuilder.andWhere('livestock.status = :status', { status });
    }

    queryBuilder
      .orderBy('livestock.sortOrder', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(id: string) {
    return this.livestockRepository.findOne({
      where: { id },
      relations: ['type'],
    });
  }

  async getStock(id: string): Promise<number> {
    const stockKey = `livestock:stock:${id}`;
    const cachedStock = await this.redisService.get(stockKey);

    if (cachedStock) {
      return Number.parseInt(cachedStock, 10);
    }

    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      return 0;
    }

    await this.redisService.set(stockKey, livestock.stock.toString());
    return livestock.stock;
  }

  async updateStock(id: string, quantity: number, manager?: any): Promise<boolean> {
    // 安全修复 B-SEC-023：验证 quantity 参数类型
    if (!Number.isFinite(quantity)) {
      throw new Error('库存变更数量必须是有效数字');
    }

    // 验证库存变更后不能为负数
    if (quantity < 0) {
      const currentStock = await this.getStock(id);
      if (currentStock < Math.abs(quantity)) {
        throw new Error('库存不足');
      }
    }

    const stockKey = `livestock:stock:${id}`;

    // 执行库存更新
    await this.executeStockUpdate(id, quantity, manager);

    // 更新缓存
    await this.refreshStockCache(id, stockKey);

    return true;
  }

  /**
   * 执行库存更新操作
   * 提取自 updateStock 以降低认知复杂度
   */
  private async executeStockUpdate(id: string, quantity: number, manager?: any): Promise<void> {
    // 根据是否有事务管理器选择更新方式
    let updateBuilder: any;
    if (manager) {
      updateBuilder = manager.createQueryBuilder().update(Livestock);
    } else {
      updateBuilder = this.livestockRepository.createQueryBuilder().update(Livestock);
    }

    // 根据数量正负决定是否更新已售数量
    let soldCountUpdate: () => string;
    if (quantity > 0) {
      soldCountUpdate = () => `soldCount + ${Math.abs(quantity)}`;
    } else {
      soldCountUpdate = () => `soldCount`;
    }

    updateBuilder
      .set({
        stock: () => `stock + ${quantity}`,
        soldCount: soldCountUpdate,
      })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * 刷新库存缓存
   */
  private async refreshStockCache(id: string, stockKey: string): Promise<void> {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (livestock) {
      await this.redisService.set(stockKey, livestock.stock.toString());
    }
  }
}
