import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Livestock, LivestockType } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Injectable()
export class LivestockService {
  constructor(
    @InjectRepository(Livestock)
    private livestockRepository: Repository<Livestock>,
    @InjectRepository(LivestockType)
    private livestockTypeRepository: Repository<LivestockType>,
    private redisService: RedisService,
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
      return parseInt(cachedStock, 10);
    }

    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      return 0;
    }

    await this.redisService.set(stockKey, livestock.stock.toString());
    return livestock.stock;
  }

  async updateStock(id: string, quantity: number, manager?: any): Promise<boolean> {
    const stockKey = `livestock:stock:${id}`;

    // 检查库存是否足够（仅在扣减时检查）
    if (quantity < 0) {
      const currentStock = await this.getStock(id);
      if (currentStock < Math.abs(quantity)) {
        throw new Error('库存不足');
      }
    }

    // 支持事务管理器
    if (manager) {
      await manager
        .createQueryBuilder()
        .update(Livestock)
        .set({
          stock: () => `stock + ${quantity}`,
          soldCount: quantity > 0 ? () => `soldCount + ${Math.abs(quantity)}` : () => `soldCount`,
        })
        .where('id = :id', { id })
        .execute();
    } else {
      await this.livestockRepository
        .createQueryBuilder()
        .update(Livestock)
        .set({
          stock: () => `stock + ${quantity}`,
          soldCount: quantity > 0 ? () => `soldCount + ${Math.abs(quantity)}` : () => `soldCount`,
        })
        .where('id = :id', { id })
        .execute();
    }

    // 更新缓存
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (livestock) {
      await this.redisService.set(stockKey, livestock.stock.toString());
    }

    return true;
  }
}
