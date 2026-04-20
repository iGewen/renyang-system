import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Livestock } from './livestock.entity';

@Entity('livestock_types')
export class LivestockType {
  @Column({ length: 32, primary: true, comment: '类型ID' })
  id: string;

  @Column({ length: 50, comment: '类型名称' })
  name: string;

  @Column({ length: 500, nullable: true, comment: '图标URL' })
  icon: string;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description: string;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1启用 2禁用',
  })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  // 关联
  @OneToMany(() => Livestock, (livestock) => livestock.type)
  livestocks: Livestock[];
}
