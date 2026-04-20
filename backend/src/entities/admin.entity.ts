import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('admins')
export class Admin {
  @Column({ length: 32, primary: true, comment: '管理员ID' })
  id: string;

  @Index()
  @Column({ length: 50, unique: true, comment: '用户名' })
  username: string;

  @Column({ length: 255, select: false, comment: '密码（加密）' })
  password: string;

  @Column({ length: 50, nullable: true, comment: '姓名' })
  name: string;

  @Column({ length: 11, nullable: true, comment: '手机号' })
  phone: string;

  @Column({ length: 500, nullable: true, comment: '头像' })
  avatar: string;

  @Column({
    type: 'tinyint',
    default: 2,
    comment: '角色：1超级管理员 2普通管理员',
  })
  role: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1启用 2禁用',
  })
  status: number;

  @Column({
    name: 'force_change_password',
    type: 'tinyint',
    default: 0,
    comment: '是否需要强制修改密码：0否 1是',
  })
  forceChangePassword: number;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true, comment: '最后登录时间' })
  lastLoginAt: Date;

  @Column({ name: 'last_login_ip', length: 45, nullable: true, comment: '最后登录IP' })
  lastLoginIp: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', comment: '软删除时间' })
  deletedAt: Date;
}
