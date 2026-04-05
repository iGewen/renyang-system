import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Adoption } from './adoption.entity';

export enum OrderStatus {
  PENDING_PAYMENT = 1, // 待支付
  PAID = 2, // 已支付
  CANCELLED = 3, // 已取消
  REFUNDED = 4, // 已退款
}

@Entity('orders')
export class Order {
  @Index()
  @Column({ length: 32, primary: true, comment: '订单ID' })
  id: string;

  @Index()
  @Column({ length: 32, unique: true, comment: '订单编号' })
  orderNo: string;

  @Index()
  @Column({ length: 32, comment: '用户ID' })
  userId: string;

  @Index()
  @Column({ length: 32, comment: '活体ID' })
  livestockId: string;

  @Column({ type: 'json', comment: '活体快照' })
  livestockSnapshot: any;

  @Column({ type: 'int', default: 1, comment: '数量' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '订单总金额' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '实付金额' })
  paidAmount: number;

  @Column({ length: 20, nullable: true, comment: '支付方式' })
  paymentMethod: string;

  @Column({ length: 64, nullable: true, comment: '支付平台订单号' })
  paymentNo: string;

  @Column({ type: 'datetime', nullable: true, comment: '支付时间' })
  paidAt: Date;

  @Index()
  @Column({
    type: 'tinyint',
    default: OrderStatus.PENDING_PAYMENT,
    comment: '状态',
  })
  status: number;

  @Column({ type: 'datetime', nullable: true, comment: '过期时间' })
  expireAt: Date;

  @Column({ length: 255, nullable: true, comment: '取消原因' })
  cancelReason: string;

  @Column({ type: 'datetime', nullable: true, comment: '取消时间' })
  canceledAt: Date;

  @Column({ length: 64, nullable: true, comment: '客户端幂等键' })
  clientOrderId: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Livestock)
  livestock: Livestock;

  @OneToOne(() => Adoption, (adoption) => adoption.order)
  adoption: Adoption;
}
