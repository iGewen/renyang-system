import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Min } from 'class-validator';
import { LivestockType } from './livestock-type.entity';
import { Order } from './order.entity';

/**
 * 精度说明：
 * price 和 monthlyFeedFee 字段使用 decimal(10,2) 存储金额。
 *
 * 业务约束：
 * - price: 领养价格，建议范围 0.01 ~ 1,000,000.00 元
 * - monthlyFeedFee: 月饲料费，建议范围 0.01 ~ 100,000.00 元
 * - stock: 库存数量，必须非负（@Min(0) 验证）
 *
 * 注意事项：
 * - 金额字段在 JavaScript 中以 string 形式返回
 * - 前端显示时需要格式化
 * - 计算时使用后端提供的计算方法
 */
@Entity('livestock')
export class Livestock {
  @Column({ length: 32, primary: true, comment: '活体ID' })
  id: string;

  @Index()
  @Column({ name: 'livestock_no', length: 24, nullable: true, comment: '活体编号(领养编号)' })
  livestockNo: string;

  @Column({ name: 'type_id', length: 32, comment: '类型ID' })
  typeId: string;

  @Column({ length: 100, comment: '活体名称' })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '领养价格' })
  price: number;

  @Column({ name: 'monthly_feed_fee', type: 'decimal', precision: 10, scale: 2, comment: '月饲料费' })
  monthlyFeedFee: number;

  @Column({ name: 'redemption_months', type: 'int', default: 12, comment: '买断所需月数' })
  redemptionMonths: number;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description: string;

  @Column({ type: 'json', nullable: true, comment: '图片列表' })
  images: string[];

  @Column({ name: 'main_image', length: 500, nullable: true, comment: '主图' })
  mainImage: string;

  @Min(0)
  @Column({ type: 'int', default: 0, comment: '库存数量' })
  stock: number;

  @Column({ name: 'sold_count', type: 'int', default: 0, comment: '已售数量' })
  soldCount: number;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '状态：1上架 2下架',
  })
  status: number;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', comment: '软删除时间' })
  deletedAt: Date;

  // 关联
  @ManyToOne(() => LivestockType)
  @JoinColumn({ name: 'type_id' })
  type: LivestockType;

  @OneToMany(() => Order, (order) => order.livestock)
  orders: Order[];
}
