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

export enum RedemptionType {
  FULL = 1, // 满期买断
  EARLY = 2, // 提前买断
}

export enum RedemptionStatus {
  PENDING_AUDIT = 1, // 待审核
  AUDIT_PASSED = 2, // 审核通过
  AUDIT_REJECTED = 3, // 审核拒绝
  PAID = 4, // 已支付
  CANCELLED = 5, // 已取消
}

@Entity('redemption_orders')
export class RedemptionOrder {
  @Index()
  @Column({ length: 32, primary: true, comment: '买断订单ID' })
  id: string;

  @Index()
  @Column({ name: 'redemption_no', length: 32, unique: true, comment: '买断编号' })
  redemptionNo: string;

  @Index()
  @Column({ name: 'adoption_id', length: 32, comment: '领养记录ID' })
  adoptionId: string;

  @Index()
  @Column({ name: 'user_id', length: 32, comment: '用户ID' })
  userId: string;

  @Index()
  @Column({ name: 'livestock_id', length: 32, comment: '活体ID' })
  livestockId: string;

  @Column({
    type: 'tinyint',
    comment: '类型：1满期买断 2提前买断',
  })
  type: number;

  @Column({ name: 'original_amount', type: 'decimal', precision: 10, scale: 2, comment: '原买断金额' })
  originalAmount: number;

  @Column({ name: 'adjusted_amount', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '调整后金额' })
  adjustedAmount: number;

  @Column({ name: 'final_amount', type: 'decimal', precision: 10, scale: 2, comment: '最终买断金额' })
  finalAmount: number;

  @Column({ name: 'adjust_reason', length: 255, nullable: true, comment: '调整原因' })
  adjustReason: string;

  @Index()
  @Column({
    type: 'tinyint',
    default: RedemptionStatus.PENDING_AUDIT,
    comment: '状态',
  })
  status: number;

  @Column({ name: 'audit_admin_id', length: 32, nullable: true, comment: '审核管理员ID' })
  auditAdminId: string;

  @Column({ name: 'audit_at', type: 'datetime', nullable: true, comment: '审核时间' })
  auditAt: Date;

  @Column({ name: 'audit_remark', length: 255, nullable: true, comment: '审核备注' })
  auditRemark: string;

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

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => Adoption)
  adoption: Adoption;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Livestock)
  livestock: Livestock;
}
