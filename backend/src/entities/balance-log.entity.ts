import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('balance_logs')
export class BalanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', comment: '用户ID' })
  userId: string;

  @Column({
    type: 'tinyint',
    comment: '类型：1充值 2消费 3退款 4调整',
  })
  type: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '变动金额' })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '变动前余额' })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '变动后余额' })
  balanceAfter: number;

  @Column({ length: 20, nullable: true, comment: '关联类型' })
  relatedType: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联ID' })
  relatedId: string;

  @Column({ length: 255, nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'uuid', nullable: true, comment: '操作管理员ID' })
  operatorId: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  // 关联
  @ManyToOne(() => User)
  user: User;
}
