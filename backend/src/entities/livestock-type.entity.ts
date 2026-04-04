import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Livestock } from './livestock.entity';

@Entity('livestock_types')
export class LivestockType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, comment: '类型名称' })
  name: string;

  @Index()
  @Column({ length: 20, unique: true, comment: '类型编码' })
  code: string;

  @Column({ length: 500, nullable: true, comment: '图标URL' })
  icon: string;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1启用 2禁用',
  })
  status: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date;

  // 关联
  @OneToMany(() => Livestock, (livestock) => livestock.type)
  livestocks: Livestock[];
}
