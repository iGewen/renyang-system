import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Order } from './order.entity';
import { FeedBill } from './feed-bill.entity';
import { LivestockSnapshot } from './snapshots.interface';

export enum AdoptionStatus {
  ACTIVE = 1, // 领养中
  FEED_OVERDUE = 2, // 饲料费逾期
  EXCEPTION = 3, // 异常
  REDEEMABLE = 4, // 可买断
  REDEMPTION_PENDING = 5, // 买断审核中
  REDEEMED = 6, // 已买断
  TERMINATED = 7, // 已终止
}

@Entity('adoptions')
export class Adoption {
  @Column({ length: 32, primary: true, comment: '领养ID' })
  id: string;

  @Index()
  @Column({ name: 'adoption_no', length: 32, unique: true, comment: '领养编号' })
  adoptionNo: string;

  @Column({ name: 'order_id', length: 32, comment: '订单ID' })
  orderId: string;

  @Column({ name: 'user_id', length: 32, comment: '用户ID' })
  userId: string;

  @Column({ name: 'livestock_id', length: 32, comment: '活体ID' })
  livestockId: string;

  @Column({ name: 'livestock_snapshot', type: 'json', comment: '活体快照' })
  livestockSnapshot: LivestockSnapshot;

  @Column({ name: 'start_date', type: 'date', comment: '领养开始日期' })
  startDate: Date;

  @Column({ name: 'redemption_months', type: 'int', comment: '买断所需月数' })
  redemptionMonths: number;

  @Column({ name: 'feed_months_paid', type: 'int', default: 0, comment: '已缴纳饲料费月数' })
  feedMonthsPaid: number;

  @Column({ name: 'total_feed_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计已缴饲料费' })
  totalFeedAmount: number;

  @Column({ name: 'late_fee_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计滞纳金' })
  lateFeeAmount: number;

  @Index()
  @Column({
    type: 'tinyint',
    default: AdoptionStatus.ACTIVE,
    comment: '状态',
  })
  status: number;

  @Column({ name: 'current_feed_bill_id', length: 64, nullable: true, comment: '当前饲料费账单ID' })
  currentFeedBillId: string;

  @Column({
    name: 'is_exception',
    type: 'tinyint',
    default: 0,
    comment: '是否异常：0否 1是',
  })
  isException: number;

  @Column({ name: 'exception_reason', length: 255, nullable: true, comment: '异常原因' })
  exceptionReason: string;

  @Column({ name: 'exception_at', type: 'datetime', nullable: true, comment: '异常标记时间' })
  exceptionAt: Date;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Livestock)
  @JoinColumn({ name: 'livestock_id' })
  livestock: Livestock;

  @OneToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @OneToMany(() => FeedBill, (bill) => bill.adoption)
  feedBills: FeedBill[];
}
