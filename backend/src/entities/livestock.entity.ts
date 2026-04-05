import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { LivestockType } from './livestock-type.entity';
import { Order } from './order.entity';

@Entity('livestock')
export class Livestock {
  @Index()
  @Column({ length: 32, primary: true, comment: '活体ID' })
  id: string;

  @Index()
  @Column({ length: 100, comment: '活体名称' })
  name: string;

  @Index()
  @Column({ length: 32, comment: '类型ID' })
  typeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '领养价格' })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '月饲料费' })
  monthlyFeedFee: number;

  @Column({ type: 'int', default: 12, comment: '买断所需月数' })
  redemptionMonths: number;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description: string;

  @Column({ type: 'json', nullable: true, comment: '图片列表' })
  images: string[];

  @Column({ length: 500, nullable: true, comment: '主图' })
  mainImage: string;

  @Column({ type: 'int', default: 0, comment: '库存数量' })
  stock: number;

  @Column({ type: 'int', default: 0, comment: '已售数量' })
  soldCount: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1上架 2下架',
  })
  status: number;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date;

  // 关联
  @ManyToOne(() => LivestockType)
  type: LivestockType;

  @OneToMany(() => Order, (order) => order.livestock)
  orders: Order[];
}
