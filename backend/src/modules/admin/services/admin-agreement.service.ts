import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '@/entities';
import { AdminService } from '../admin.service';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class AdminAgreementService {
  private readonly logger = new Logger(AdminAgreementService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly adminService: AdminService,
  ) {}

  /**
   * 获取协议列表
   */
  async getAgreements() {
    const configs = await this.systemConfigRepository.find({
      where: { configType: 'agreement' },
      order: { createdAt: 'ASC' },
    });

    return configs.map(config => ({
      id: config.id,
      agreementKey: config.configKey,
      title: config.description || config.configKey,
      content: config.configValue,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * 获取单个协议
   */
  async getAgreement(key: string) {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key, configType: 'agreement' },
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      agreementKey: config.configKey,
      title: config.description || config.configKey,
      content: config.configValue,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 保存协议
   */
  async saveAgreement(data: { agreementKey: string; title: string; content: string }, adminId: string, adminName: string, ip?: string) {
    let config = await this.systemConfigRepository.findOne({
      where: { configKey: data.agreementKey, configType: 'agreement' },
    });

    if (config) {
      const beforeData = { title: config.description, content: config.configValue };
      config.configValue = data.content;
      config.description = data.title;
      config.configType = 'agreement';
      await this.systemConfigRepository.save(config);

      await this.adminService.createAuditLog({
        adminId,
        adminName,
        module: 'agreement',
        action: 'update',
        targetType: 'agreement',
        targetId: config.id,
        beforeData,
        afterData: { title: data.title, content: data.content },
        remark: `更新协议: ${data.title}`,
        ip,
      });

      return { success: true, id: config.id };
    } else {
      config = this.systemConfigRepository.create({
        id: IdUtil.generate('AG'),
        configKey: data.agreementKey,
        configValue: data.content,
        configType: 'agreement',
        description: data.title,
      });
      await this.systemConfigRepository.save(config);

      await this.adminService.createAuditLog({
        adminId,
        adminName,
        module: 'agreement',
        action: 'create',
        targetType: 'agreement',
        targetId: config.id,
        afterData: { key: data.agreementKey, title: data.title },
        remark: `创建协议: ${data.title}`,
        ip,
      });

      return { success: true, id: config.id };
    }
  }

  /**
   * 删除协议
   */
  async deleteAgreement(key: string, adminId: string, adminName: string, ip?: string) {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key, configType: 'agreement' },
    });

    if (!config) {
      throw new NotFoundException('协议不存在');
    }

    await this.systemConfigRepository.remove(config);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'agreement',
      action: 'delete',
      targetType: 'agreement',
      targetId: config.id,
      beforeData: { key, title: config.description },
      remark: `删除协议: ${config.description}`,
      ip,
    });

    return { success: true };
  }
}
