import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Livestock } from './livestock.entity';
import { Order } from './order.entity';
import { FeedBill } from './feed-bill.entity';

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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 32, unique: true, comment: '领养编号' })
  adoptionNo: string;

  @Index()
  @Column({ type: 'uuid', comment: '订单ID' })
  orderId: string;

  @Index()
  @Column({ type: 'uuid', comment: '用户ID' })
  userId: string;

  @Index()
  @Column({ type: 'uuid', comment: '活体ID' })
  livestockId: string;

  @Column({ type: 'json', comment: '活体快照' })
  livestockSnapshot: any;

  @Column({ type: 'date', comment: '领养开始日期' })
  startDate: Date;

  @Column({ type: 'int', comment: '买断所需月数' })
  redemptionMonths: number;

  @Column({ type: 'int', default: 0, comment: '已缴纳饲料费月数' })
  feedMonthsPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计已缴饲料费' })
  totalFeedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '累计滞纳金' })
  lateFeeAmount: number;

  @Index()
  @Column({
    type: 'tinyint',
    default: AdoptionStatus.ACTIVE,
    comment: '状态',
  })
  status: number;

  @Column({ type: 'uuid', nullable: true, comment: '当前饲料费账单ID' })
  currentFeedBillId: string;

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '是否异常：0否 1是',
  })
  isException: number;

  @Column({ length: 255, nullable: true, comment: '异常原因' })
  exceptionReason: string;

  @Column({ type: 'datetime', nullable: true, comment: '异常标记时间' })
  exceptionAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Livestock)
  livestock: Livestock;

  @OneToOne(() => Order)
  order: Order;

  @OneToMany(() => FeedBill, (bill) => bill.adoption)
  feedBills: FeedBill[];
}
