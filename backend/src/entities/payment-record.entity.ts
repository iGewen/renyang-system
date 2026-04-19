import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum PaymentStatus {
  PENDING = 1, // 待支付
  SUCCESS = 2, // 支付成功
  FAILED = 3, // 支付失败
  CLOSED = 4, // 已关闭
}

@Entity('payment_records')
export class PaymentRecord {
  @Column({ length: 32, primary: true, comment: '支付记录ID' })
  id: string;

  @Index()
  @Column({ name: 'payment_no', length: 64, unique: true, comment: '支付平台订单号' })
  paymentNo: string;

  @Index()
  @Column({ name: 'out_trade_no', length: 32, nullable: true, comment: '商户订单号' })
  outTradeNo: string;

  @Column({ name: 'user_id', length: 32, comment: '用户ID' })
  userId: string;

  @Column({ name: 'order_type', length: 20, comment: '订单类型：adoption/feed/redemption/recharge' })
  orderType: string;

  @Column({ name: 'order_id', length: 32, comment: '订单ID' })
  orderId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '支付金额' })
  amount: number;

  @Column({ name: 'payment_method', length: 20, comment: '支付方式：alipay/wechat/balance' })
  paymentMethod: string;

  @Index()
  @Column({
    type: 'tinyint',
    default: PaymentStatus.PENDING,
    comment: '状态',
  })
  status: number;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true, comment: '支付时间' })
  paidAt: Date;

  @Column({ name: 'notify_at', type: 'datetime', nullable: true, comment: '回调时间' })
  notifyAt: Date;

  @Column({ name: 'notify_data', type: 'json', nullable: true, comment: '回调数据' })
  notifyData: any;

  // 第三方交易号（支付宝trade_no/微信transaction_id）
  @Column({ name: 'transaction_id', length: 64, nullable: true, comment: '第三方交易号' })
  transactionId: string;

  // 乐观锁版本号
  @VersionColumn({ comment: '乐观锁版本号' })
  version: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  // 关联
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
