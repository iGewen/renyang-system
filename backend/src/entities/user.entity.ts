import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Order } from './order.entity';
import { Adoption } from './adoption.entity';
import { BalanceLog } from './balance-log.entity';

@Entity('users')
export class User {
  @Index()
  @Column({ length: 32, primary: true, comment: '用户ID' })
  id: string;

  @Index()
  @Column({ length: 11, unique: true, comment: '手机号' })
  phone: string;

  @Column({ length: 255, nullable: true, select: false, comment: '密码（加密）' })
  password: string;

  @Column({ length: 50, nullable: true, comment: '昵称' })
  nickname: string;

  @Column({ length: 500, nullable: true, comment: '头像URL' })
  avatar: string;

  @Index()
  @Column({ length: 64, nullable: true, unique: true, comment: '微信OpenID' })
  wechatOpenId: string;

  @Column({ length: 64, nullable: true, comment: '微信UnionID' })
  wechatUnionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '账户余额（元）' })
  balance: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1正常 2限制 3封禁',
  })
  status: number;

  @Column({ type: 'datetime', nullable: true, comment: '最后登录时间' })
  lastLoginAt: Date;

  @Column({ length: 45, nullable: true, comment: '最后登录IP' })
  lastLoginIp: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date;

  // 关联
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Adoption, (adoption) => adoption.user)
  adoptions: Adoption[];

  @OneToMany(() => BalanceLog, (log) => log.user)
  balanceLogs: BalanceLog[];
}
