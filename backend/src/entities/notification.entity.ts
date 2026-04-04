import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, comment: '用户ID（为空则全员）' })
  userId: string;

  @Column({ length: 100, comment: '标题' })
  title: string;

  @Column({ type: 'text', comment: '内容' })
  content: string;

  @Column({ length: 20, comment: '类型：system/order/feed/redemption/balance' })
  type: string;

  @Column({ length: 20, nullable: true, comment: '关联类型' })
  relatedType: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联ID' })
  relatedId: string;

  @Index()
  @Column({
    type: 'tinyint',
    default: 0,
    comment: '是否已读：0否 1是',
  })
  isRead: number;

  @Column({ type: 'datetime', nullable: true, comment: '阅读时间' })
  readAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
