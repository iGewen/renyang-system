import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @Column({ length: 32, primary: true, comment: '日志ID' })
  id: string;

  @Index()
  @Column({ name: 'admin_id', length: 32, nullable: true, comment: '管理员ID' })
  adminId: string;

  @Column({ name: 'admin_name', length: 50, nullable: true, comment: '管理员用户名' })
  adminName: string;

  @Column({ length: 50, comment: '操作类型' })
  action: string;

  @Column({ name: 'target_type', length: 50, nullable: true, comment: '目标类型' })
  targetType: string;

  @Index()
  @Column({ name: 'target_id', length: 32, nullable: true, comment: '目标ID' })
  targetId: string;

  @Column({ name: 'old_value', type: 'json', nullable: true, comment: '旧值' })
  oldValue: any;

  @Column({ name: 'new_value', type: 'json', nullable: true, comment: '新值' })
  newValue: any;

  @Column({ length: 45, nullable: true, comment: 'IP地址' })
  ip: string;

  @Column({ name: 'user_agent', length: 500, nullable: true, comment: '用户代理' })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;
}
