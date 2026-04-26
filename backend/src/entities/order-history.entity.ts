import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

/**
 * 订单历史记录实体
 * 记录订单状态变更的完整历史
 */
@Entity('order_history')
export class OrderHistory {
  @Column({ type: 'varchar', length: 32, primary: true, comment: '历史记录ID' })
  id: string;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 32, comment: '订单ID' })
  orderId: string;

  @Column({ name: 'from_status', type: 'tinyint', nullable: true, comment: '变更前状态' })
  fromStatus: number;

  @Column({ name: 'to_status', type: 'tinyint', comment: '变更后状态' })
  toStatus: number;

  @Column({ name: 'operator_id', type: 'varchar', length: 32, nullable: true, comment: '操作人ID' })
  operatorId: string;

  @Column({ name: 'operator_type', type: 'varchar', length: 20, comment: '操作人类型：user/admin/system' })
  operatorType: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '变更原因/备注' })
  remark: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  // 关联
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
