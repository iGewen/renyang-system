import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column({ name: 'admin_id', length: 32, nullable: true, comment: '管理员ID' })
  adminId: string;

  @Column({ name: 'admin_name', length: 50, nullable: true, comment: '管理员用户名' })
  adminName: string;

  @Column({ length: 50, comment: '模块' })
  module: string;

  @Column({ length: 50, comment: '操作' })
  action: string;

  @Column({ name: 'target_type', length: 50, nullable: true, comment: '目标类型' })
  targetType: string;

  @Index()
  @Column({ name: 'target_id', length: 64, nullable: true, comment: '目标ID' })
  targetId: string;

  @Column({ name: 'before_data', type: 'json', nullable: true, comment: '操作前数据' })
  beforeData: any;

  @Column({ name: 'after_data', type: 'json', nullable: true, comment: '操作后数据' })
  afterData: any;

  @Column({
    name: 'is_sensitive',
    type: 'tinyint',
    default: 0,
    comment: '是否敏感操作',
  })
  isSensitive: number;

  @Column({ length: 500, nullable: true, comment: '备注' })
  remark: string;

  @Column({ length: 45, nullable: true, comment: '操作IP' })
  ip: string;

  @Column({ name: 'user_agent', length: 500, nullable: true, comment: '浏览器UA' })
  userAgent: string;

  @Index()
  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;
}
