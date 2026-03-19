import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Alert, AlertEvent, CreateAlertDto, CreateAlertEventDto, AlertStatus, UpdateAlertDto } from '@videri/shared';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { v4 as uuidv4 } from 'uuid';

type AlertPageResult = {
  data: Alert[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
    private kafkaProducer: KafkaProducerService,
    private dataSource: DataSource,
  ) {}

  async createAlert(dto: CreateAlertDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // Create and save alert
      const alert = this.alertRepo.create({
        orgId: dto.orgId,
        alertId: uuidv4(),
        alertContext: dto.alertContext,
        status: dto.status || AlertStatus.NEW,
        createdBy: dto.createdBy,
      });
      const savedAlert = await queryRunner.manager.save(alert);
      
      // Create and save alert event in the same transaction
      const alertEvent = this.alertEventRepo.create({
        orgId: dto.orgId,
        alertId: savedAlert.id,
        eventId: uuidv4(),
        eventData: {
          eventType: 'ALERT_CREATED',
          alertContext: savedAlert.alertContext,
          status: savedAlert.status,
          createdAt: savedAlert.createdAt.toISOString(),
        },
        createdBy: dto.createdBy,
      });
      await queryRunner.manager.save(alertEvent);
      
      await queryRunner.commitTransaction();
      return savedAlert;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAlertsByOrg(orgId: string, status?: string) {
    return this.getAlertsByOrgAndCreator(orgId, status);
  }

  async getAlertsByOrgAndCreator(orgId: string, status?: string, createdBy?: string) {
    const query = this.alertRepo.createQueryBuilder('alert')
      .where('alert.orgId = :orgId', { orgId })
      .orderBy('alert.createdAt', 'DESC');

    if (status) {
      query.andWhere('alert.status = :status', { status });
    }

    if (createdBy) {
      query.andWhere('alert.createdBy = :createdBy', { createdBy });
    }

    return query.getMany();
  }

  async getAlertsByOrgAndCreatorPaginated(
    orgId: string,
    status?: string,
    createdBy?: string,
    page?: number,
    pageSize?: number,
  ): Promise<AlertPageResult> {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page as number)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize as number))) : 10;

    const query = this.alertRepo
      .createQueryBuilder('alert')
      .where('alert.orgId = :orgId', { orgId })
      .orderBy('alert.createdAt', 'DESC');

    if (status) {
      query.andWhere('alert.status = :status', { status });
    }

    if (createdBy) {
      query.andWhere('alert.createdBy = :createdBy', { createdBy });
    }

    const [data, total] = await query
      .skip((safePage - 1) * safePageSize)
      .take(safePageSize)
      .getManyAndCount();

    return {
      data,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
  }

  async updateAlertStatus(id: string, orgId: string, status: AlertStatus, updatedBy: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const alert = await queryRunner.manager.findOne(Alert, {
        where: { id, orgId },
      });
      if (!alert) {
        throw new ForbiddenException('Alert not found in this organization');
      }
      const previousStatus = alert.status;
      alert.status = status;
      alert.updatedBy = updatedBy;
      const updatedAlert = await queryRunner.manager.save(alert);

      // Create event in the same transaction
      const eventData = this.alertEventRepo.create({
        orgId,
        alertId: alert.id,
        eventId: uuidv4(),
        eventData: {
          eventType: 'ALERT_STATUS_CHANGED',
          alertId: alert.id,
          previousStatus,
          newStatus: status,
          changedAt: new Date().toISOString(),
        },
        createdBy: updatedBy,
      });
      await queryRunner.manager.save(eventData);

      await queryRunner.commitTransaction();
      return updatedAlert;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createAlertEvent(dto: CreateAlertEventDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const alertEvent = this.alertEventRepo.create({
        orgId: dto.orgId,
        alertId: dto.alertId,
        eventId: uuidv4(),
        eventData: {
          eventType: 'ALERT_EVENT_CREATED',
          ...dto.eventData,
        },
        createdBy: dto.createdBy,
      });

      const savedEvent = await queryRunner.manager.save(alertEvent);
      await queryRunner.commitTransaction();
      return savedEvent;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAlertEventsByAlert(alertId: string, orgId: string) {
    return this.alertEventRepo.find({
      where: {
        orgId,
        alertId,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateAlert(id: string, orgId: string, updatedBy: string, dto: UpdateAlertDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const alert = await queryRunner.manager.findOne(Alert, { where: { id, orgId } });
      if (!alert) {
        throw new ForbiddenException('Alert not found in this organization');
      }

      const previousStatus = alert.status;
      const nextStatus = dto.status ?? alert.status;
      const contextChanged = dto.alertContext && dto.alertContext !== alert.alertContext;
      const statusChanged = dto.status && dto.status !== alert.status;

      if (dto.alertContext) {
        alert.alertContext = dto.alertContext;
      }
      alert.status = nextStatus;
      alert.updatedBy = updatedBy;

      const updatedAlert = await queryRunner.manager.save(alert);

      if (statusChanged) {
        const eventData = this.alertEventRepo.create({
          orgId,
          alertId: alert.id,
          eventId: uuidv4(),
          eventData: {
            eventType: 'ALERT_STATUS_CHANGED',
            alertId: alert.id,
            previousStatus,
            newStatus: nextStatus,
            changedAt: new Date().toISOString(),
          },
          createdBy: updatedBy,
        });
        await queryRunner.manager.save(eventData);
      } else if (contextChanged) {
        const contextEventData = this.alertEventRepo.create({
          orgId,
          alertId: alert.id,
          eventId: uuidv4(),
          eventData: {
            eventType: 'ALERT_CONTEXT_CHANGED',
            alertId: alert.id,
            alertContext: alert.alertContext,
            changedAt: new Date().toISOString(),
          },
          createdBy: updatedBy,
        });
        await queryRunner.manager.save(contextEventData);
      }

      await queryRunner.commitTransaction();
      return updatedAlert;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAlert(id: string, orgId: string) {
    const alert = await this.alertRepo.findOne({ where: { id, orgId } });
    if (!alert) {
      throw new ForbiddenException('Alert not found in this organization');
    }
    // Remove child events first to satisfy FK constraint before deleting alert
    await this.alertEventRepo.delete({ alertId: alert.id, orgId });
    await this.alertRepo.delete({ id, orgId });
    return { success: true };
  }
}
