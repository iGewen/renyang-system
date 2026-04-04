import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_configs')
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 50, unique: true, comment: '配置键' })
  configKey: string;

  @Column({ type: 'text', nullable: true, comment: '配置值（JSON）' })
  configValue: string;

  @Column({ length: 20, comment: '配置类型：payment/sms/business/other' })
  configType: string;

  @Column({ length: 255, nullable: true, comment: '配置说明' })
  description: string;

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '是否加密：0否 1是',
  })
  isEncrypted: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
