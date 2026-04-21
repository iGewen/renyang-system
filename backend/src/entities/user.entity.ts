import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Adoption } from './adoption.entity';
import { BalanceLog } from './balance-log.entity';

/**
 * 用户状态枚举
 */
export enum UserStatus {
  NORMAL = 1,   // 正常
  RESTRICTED = 2, // 受限
  BANNED = 3,   // 封禁
}

@Entity('users')
export class User {
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
  @Column({ name: 'wechat_openid', length: 64, nullable: true, unique: true, comment: '微信OpenID' })
  wechatOpenId: string;

  @Column({ name: 'wechat_unionid', length: 64, nullable: true, comment: '微信UnionID' })
  wechatUnionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '账户余额（元）' })
  balance: number;

  @Column({
    type: 'tinyint',
    default: UserStatus.NORMAL,
    comment: '状态：1正常 2限制 3封禁',
  })
  status: number;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true, comment: '最后登录时间' })
  lastLoginAt: Date;

  @Column({ name: 'last_login_ip', length: 45, nullable: true, comment: '最后登录IP' })
  lastLoginIp: string;

  // 乐观锁版本号
  @VersionColumn({ comment: '乐观锁版本号' })
  version: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', comment: '软删除时间' })
  deletedAt: Date;

  // 关联
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Adoption, (adoption) => adoption.user)
  adoptions: Adoption[];

  @OneToMany(() => BalanceLog, (log) => log.user)
  balanceLogs: BalanceLog[];
}
