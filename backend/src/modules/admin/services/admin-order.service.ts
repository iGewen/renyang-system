import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, AuditLog, OrderStatus, Adoption } from '@/entities';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly adminService: AdminService,
  ) {}

  async getOrderList(params: {
    page: number;
    pageSize: number;
    status?: OrderStatus;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.adoption', 'adoption');

    if (params.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', { status: params.status });
    }

    // 安全修复：移除了 orderType 查询，因为 Order 实体没有 orderType 字段
    // 如需区分订单类型，可通过 adoption 关联是否存在来判断

    if (params.keyword) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :keyword OR user.phone LIKE :keyword OR user.nickname LIKE :keyword OR adoption.adoptionNo LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    if (params.startDate && params.endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    queryBuilder
      .orderBy('order.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'livestock', 'adoption'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return order;
  }

  /**
   * 删除订单
   * 安全修复：改为软删除，保留数据用于审计和恢复
   */
  async deleteOrder(orderId: string, adminId: string, adminName: string, ip: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['adoption'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 只有已取消或已退款的订单可以删除
    if (order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REFUNDED) {
      throw new BadRequestException('只能删除已取消或已退款的订单');
    }

    // 软删除关联的领养记录（如果存在）
    if (order.adoption) {
      await this.adoptionRepository.softDelete(order.adoption.id);
    }

    // 软删除订单（保留数据用于审计和恢复）
    await this.orderRepository.softDelete(orderId);

    // 记录审计日志
    const auditLog = this.auditLogRepository.create({
      adminId,
      adminName,
      module: 'order',
      action: 'delete',
      targetType: 'order',
      targetId: orderId,
      beforeData: {
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: order.totalAmount,
      },
      remark: `软删除订单: ${order.orderNo}`,
      ip,
    });
    await this.auditLogRepository.save(auditLog);

    return { success: true, message: '订单已删除' };
  }
}
