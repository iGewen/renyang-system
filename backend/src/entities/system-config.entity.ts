import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_configs')
export class SystemConfig {
  @Column({ length: 32, primary: true, comment: '配置ID' })
  id: string;

  @Index()
  @Column({ name: 'config_key', length: 50, unique: true, comment: '配置键' })
  configKey: string;

  @Column({ name: 'config_value', type: 'text', nullable: true, comment: '配置值（JSON）' })
  configValue: string;

  @Column({ name: 'config_type', length: 20, nullable: true, default: 'basic', comment: '配置类型：payment/sms/business/other' })
  configType: string;

  @Column({ length: 255, nullable: true, comment: '配置说明' })
  description: string;

  @Column({
    name: 'is_encrypted',
    type: 'tinyint',
    default: 0,
    comment: '是否加密：0否 1是',
  })
  isEncrypted: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
