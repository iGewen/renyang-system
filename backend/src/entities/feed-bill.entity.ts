import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Adoption } from './adoption.entity';

/**
 * 精度说明：
 * 本实体中使用 decimal 类型存储金额相关字段。
 * - decimal(10,2): 金额字段，精确到分
 * - decimal(5,4): 滞纳金比例（日），如 0.0005 表示每日 0.05%
 *
 * 风险评估：
 * 1. 滞纳金计算采用累加方式（totalLateFee），避免单次计算误差
 * 2. 所有金额字段在 JavaScript 中以 string 形式返回，避免浮点精度问题
 * 3. 计算时应使用精确计算库（如 decimal.js）或后端服务方法
 *
 * 业务约束：
 * - lateFeeRate 建议范围：0 ~ 0.01（日利率最高 1%）
 * - lateFeeCap 建议设置为原金额的 50%~100%
 */
export enum FeedBillStatus {
  PENDING = 1, // 待支付
  PAID = 2, // 已支付
  OVERDUE = 3, // 已逾期
  WAIVED = 4, // 已免除
}

@Entity('feed_bills')
export class FeedBill {
  @Column({ length: 32, primary: true, comment: '饲料账单ID' })
  id: string;

  @Index()
  @Column({ name: 'bill_no', length: 32, unique: true, comment: '账单编号' })
  billNo: string;

  @Column({ name: 'adoption_id', length: 32, comment: '领养记录ID' })
  adoptionId: string;

  @Column({ name: 'user_id', length: 32, comment: '用户ID' })
  userId: string;

  @Column({ name: 'livestock_id', length: 32, comment: '活体ID' })
  livestockId: string;

  @Index()
  @Column({ name: 'bill_month', length: 7, comment: '账单月份：2026-04' })
  billMonth: string;

  @Column({ name: 'bill_date', type: 'date', comment: '账单日期' })
  billDate: Date;

  @Column({ name: 'original_amount', type: 'decimal', precision: 10, scale: 2, comment: '原金额' })
  originalAmount: number;

  @Column({ name: 'adjusted_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '调整后金额' })
  adjustedAmount: number;

  @Column({ name: 'late_fee_rate', type: 'decimal', precision: 5, scale: 4, nullable: true, comment: '滞纳金比例（日）' })
  lateFeeRate: number;

  @Column({ name: 'late_fee_cap', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '滞纳金上限' })
  lateFeeCap: number;

  @Column({ name: 'late_fee_days', type: 'int', default: 0, comment: '逾期天数' })
  lateFeeDays: number;

  @Column({ name: 'late_fee_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '滞纳金金额' })
  lateFeeAmount: number;

  @Column({ name: 'total_late_fee', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计滞纳金' })
  totalLateFee: number;

  @Column({ name: 'late_fee_start_date', type: 'date', nullable: true, comment: '滞纳金开始计算日期' })
  lateFeeStartDate: Date;

  @Index()
  @Column({
    type: 'tinyint',
    default: FeedBillStatus.PENDING,
    comment: '状态',
  })
  status: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '实付金额' })
  paidAmount: number;

  @Column({ name: 'payment_method', length: 20, nullable: true, comment: '支付方式' })
  paymentMethod: string;

  @Column({ name: 'payment_no', length: 64, nullable: true, comment: '支付平台订单号' })
  paymentNo: string;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true, comment: '支付时间' })
  paidAt: Date;

  @Column({ name: 'expire_at', type: 'datetime', nullable: true, comment: '过期时间' })
  expireAt: Date;

  @Column({ name: 'adjust_reason', length: 255, nullable: true, comment: '调整原因' })
  adjustReason: string;

  @Column({ name: 'operator_id', length: 32, nullable: true, comment: '操作管理员ID' })
  operatorId: string;

  // 乐观锁版本号
  @VersionColumn({ comment: '乐观锁版本号' })
  version: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => Adoption)
  @JoinColumn({ name: 'adoption_id' })
  adoption: Adoption;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Livestock)
  @JoinColumn({ name: 'livestock_id' })
  livestock: Livestock;
}
