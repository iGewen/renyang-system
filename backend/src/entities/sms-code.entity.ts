import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('sms_codes')
export class SmsCode {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 11, comment: '手机号' })
  phone: string;

  @Column({ length: 6, comment: '验证码' })
  code: string;

  @Column({ length: 20, comment: '类型：register/login/reset_password' })
  type: string;

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '是否已使用',
  })
  isUsed: number;

  @Column({ type: 'datetime', comment: '过期时间' })
  expireAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
