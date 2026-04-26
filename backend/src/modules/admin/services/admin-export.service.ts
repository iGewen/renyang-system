import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { User, Order, Adoption, FeedBill } from '@/entities';

@Injectable()
export class AdminExportService {
  private readonly logger = new Logger(AdminExportService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private readonly feedBillRepository: Repository<FeedBill>,
  ) {}

  /**
   * 导出用户数据
   */
  async exportUsers(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (params.status) {
      queryBuilder.andWhere('user.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('user.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('user.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');

    const users = await queryBuilder.getMany();

    const data = users.map(user => ({
      '用户ID': user.id,
      '手机号': user.phone,
      '昵称': user.nickname || '',
      '余额': Number(user.balance).toFixed(2),
      '状态': this.getUserStatusText(user.status),
      '最后登录时间': user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '',
      '注册时间': new Date(user.createdAt).toLocaleString('zh-CN'),
    }));

    return await this.generateExcelBase64(data, '用户数据');
  }

  /**
   * 导出订单数据
   */
  async exportOrders(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.user', 'user');

    if (params.status) {
      queryBuilder.andWhere('order.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const orders = await queryBuilder.getMany();

    const data = orders.map(order => ({
      '订单ID': order.id,
      '订单编号': order.orderNo,
      '用户手机号': order.user?.phone || '',
      '活体名称': order.livestockSnapshot?.name || order.livestock?.name || '',
      '数量': order.quantity,
      '订单金额': Number(order.totalAmount).toFixed(2),
      '实付金额': Number(order.paidAmount || 0).toFixed(2),
      '支付方式': order.paymentMethod || '',
      '状态': this.getOrderStatusText(order.status),
      '创建时间': new Date(order.createdAt).toLocaleString('zh-CN'),
      '支付时间': order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '',
    }));

    return await this.generateExcelBase64(data, '订单数据');
  }

  /**
   * 导出领养数据
   */
  async exportAdoptions(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.adoptionRepository.createQueryBuilder('adoption')
      .leftJoinAndSelect('adoption.user', 'user')
      .leftJoinAndSelect('adoption.livestock', 'livestock');

    if (params.status) {
      queryBuilder.andWhere('adoption.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('adoption.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('adoption.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('adoption.createdAt', 'DESC');

    const adoptions = await queryBuilder.getMany();

    const statusMap: Record<number, string> = {
      1: '领养中', 2: '饲料费逾期', 3: '异常', 4: '可买断',
      5: '买断审核中', 6: '已买断', 7: '已终止'
    };

    const data = adoptions.map(adoption => ({
      '领养ID': adoption.id,
      '领养编号': adoption.adoptionNo,
      '用户手机号': adoption.user?.phone || '',
      '活体名称': adoption.livestockSnapshot?.name || adoption.livestock?.name || '',
      '开始日期': new Date(adoption.startDate).toLocaleDateString('zh-CN'),
      '已缴月数': adoption.feedMonthsPaid,
      '累计饲料费': Number(adoption.totalFeedAmount || 0).toFixed(2),
      '滞纳金': Number(adoption.lateFeeAmount || 0).toFixed(2),
      '状态': statusMap[adoption.status] || '未知',
      '创建时间': new Date(adoption.createdAt).toLocaleString('zh-CN'),
    }));

    return await this.generateExcelBase64(data, '领养数据');
  }

  /**
   * 导出饲料费账单数据
   */
  async exportFeedBills(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.feedBillRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.user', 'user')
      .leftJoinAndSelect('bill.adoption', 'adoption');

    if (params.status) {
      queryBuilder.andWhere('bill.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('bill.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('bill.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('bill.createdAt', 'DESC');

    const bills = await queryBuilder.getMany();

    const statusMap: Record<number, string> = {
      1: '待支付', 2: '已支付', 3: '逾期', 4: '已豁免'
    };

    const data = bills.map(bill => ({
      '账单ID': bill.id,
      '账单编号': bill.billNo,
      '领养编号': bill.adoption?.adoptionNo || '',
      '用户手机号': bill.user?.phone || '',
      '账单月份': bill.billMonth,
      '账单金额': Number(bill.adjustedAmount || bill.originalAmount).toFixed(2),
      '滞纳金': Number(bill.lateFeeAmount || 0).toFixed(2),
      '状态': statusMap[bill.status] || '未知',
      '支付时间': bill.paidAt ? new Date(bill.paidAt).toLocaleString('zh-CN') : '',
      '创建时间': new Date(bill.createdAt).toLocaleString('zh-CN'),
    }));

    return await this.generateExcelBase64(data, '饲料费账单');
  }

  /**
   * 生成Excel Base64
   */
  private async generateExcelBase64(data: any[], sheetName: string): Promise<{ base64: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '云端牧场';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);

      worksheet.columns = headers.map(key => ({
        header: key,
        key: key,
        width: Math.max(key.length * 2, 15)
      }));

      data.forEach(row => {
        worksheet.addRow(row);
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const filename = `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { base64, filename };
  }

  private getUserStatusText(status: number): string {
    if (status === 1) return '正常';
    if (status === 2) return '限制';
    return '封禁';
  }

  private getOrderStatusText(status: number): string {
    if (status === 1) return '待支付';
    if (status === 2) return '已支付';
    if (status === 3) return '已取消';
    return '已退款';
  }
}
