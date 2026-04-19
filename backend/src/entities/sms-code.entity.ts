import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sms_codes')
@Index(['phone', 'code']) // 复合索引：优化验证码查询
@Index(['phone', 'type', 'isUsed']) // 复合索引：优化发送频率检查和验证查询
export class SmsCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 11, comment: '手机号' })
  phone: string;

  @Column({ length: 6, comment: '验证码' })
  code: string;

  @Column({ length: 20, comment: '类型：register/login/reset_password' })
  type: string;

  @Column({
    name: 'is_used',
    type: 'tinyint',
    default: 0,
    comment: '是否已使用',
  })
  isUsed: number;

  @Column({ name: 'expire_at', type: 'datetime', comment: '过期时间' })
  expireAt: Date;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;
}
