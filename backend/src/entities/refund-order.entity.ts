import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum RefundType {
  USER_APPLY = 1, // 用户申请
  ADMIN_OPERATE = 2, // 管理员操作
  SYSTEM_AUTO = 3, // 系统自动
}

export enum RefundStatus {
  PENDING_AUDIT = 1, // 待审核
  AUDIT_PASSED = 2, // 审核通过
  AUDIT_REJECTED = 3, // 审核拒绝
  REFUNDED = 4, // 已退款
  CANCELLED = 5, // 已取消
}

@Entity('refund_orders')
export class RefundOrder {
  @Column({ length: 32, primary: true, comment: '退款订单ID' })
  id: string;

  @Index()
  @Column({ name: 'refund_no', length: 32, unique: true, comment: '退款编号' })
  refundNo: string;

  @Index()
  @Column({ name: 'user_id', length: 32, comment: '用户ID' })
  userId: string;

  @Column({ name: 'order_type', length: 20, comment: '订单类型：adoption/feed/redemption' })
  orderType: string;

  @Index()
  @Column({ name: 'order_id', length: 32, comment: '原订单ID' })
  orderId: string;

  @Column({ name: 'original_amount', type: 'decimal', precision: 10, scale: 2, comment: '原订单金额' })
  originalAmount: number;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, comment: '退款金额' })
  refundAmount: number;

  @Column({
    name: 'refund_livestock',
    type: 'tinyint',
    default: 2,
    comment: '是否退活体：1是 2否',
  })
  refundLivestock: number;

  @Column({ length: 255, nullable: true, comment: '退款原因' })
  reason: string;

  @Column({
    type: 'tinyint',
    comment: '类型：1用户申请 2管理员操作 3系统自动',
  })
  type: number;

  @Index()
  @Column({
    type: 'tinyint',
    default: RefundStatus.PENDING_AUDIT,
    comment: '状态',
  })
  status: number;

  @Column({ name: 'audit_admin_id', length: 32, nullable: true, comment: '审核管理员ID' })
  auditAdminId: string;

  @Column({ name: 'audit_at', type: 'datetime', nullable: true, comment: '审核时间' })
  auditAt: Date;

  @Column({ name: 'audit_remark', length: 255, nullable: true, comment: '审核备注' })
  auditRemark: string;

  @Column({ name: 'operator_id', length: 32, nullable: true, comment: '操作管理员ID' })
  operatorId: string;

  @Column({ name: 'refund_method', length: 20, nullable: true, comment: '退款方式' })
  refundMethod: string;

  @Column({ name: 'refund_at', type: 'datetime', nullable: true, comment: '退款完成时间' })
  refundAt: Date;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
