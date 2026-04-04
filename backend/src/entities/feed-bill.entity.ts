import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Adoption } from './adoption.entity';

export enum FeedBillStatus {
  PENDING = 1, // 待支付
  PAID = 2, // 已支付
  OVERDUE = 3, // 已逾期
  WAIVED = 4, // 已免除
}

@Entity('feed_bills')
export class FeedBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 32, unique: true, comment: '账单编号' })
  billNo: string;

  @Index()
  @Column({ type: 'uuid', comment: '领养记录ID' })
  adoptionId: string;

  @Index()
  @Column({ type: 'uuid', comment: '用户ID' })
  userId: string;

  @Index()
  @Column({ type: 'uuid', comment: '活体ID' })
  livestockId: string;

  @Index()
  @Column({ length: 7, comment: '账单月份：2026-04' })
  billMonth: string;

  @Column({ type: 'date', comment: '账单日期' })
  billDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '原金额' })
  originalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '调整后金额' })
  adjustedAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, comment: '滞纳金比例（日）' })
  lateFeeRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '滞纳金上限' })
  lateFeeCap: number;

  @Column({ type: 'int', default: 0, comment: '逾期天数' })
  lateFeeDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '滞纳金金额' })
  lateFeeAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计滞纳金' })
  totalLateFee: number;

  @Column({ type: 'date', nullable: true, comment: '滞纳金开始计算日期' })
  lateFeeStartDate: Date;

  @Index()
  @Column({
    type: 'tinyint',
    default: FeedBillStatus.PENDING,
    comment: '状态',
  })
  status: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '实付金额' })
  paidAmount: number;

  @Column({ length: 20, nullable: true, comment: '支付方式' })
  paymentMethod: string;

  @Column({ length: 64, nullable: true, comment: '支付平台订单号' })
  paymentNo: string;

  @Column({ type: 'datetime', nullable: true, comment: '支付时间' })
  paidAt: Date;

  @Column({ type: 'datetime', nullable: true, comment: '过期时间' })
  expireAt: Date;

  @Column({ length: 255, nullable: true, comment: '调整原因' })
  adjustReason: string;

  @Column({ type: 'uuid', nullable: true, comment: '操作管理员ID' })
  operatorId: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => Adoption)
  adoption: Adoption;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Livestock)
  livestock: Livestock;
}
