import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { AlertEvent } from './entities/alert-event.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { CreateAlertEventDto } from './dto/create-alert-event.dto';
import { AlertStatus } from './enums/alert-status.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
  ) {}

  async createAlert(dto: CreateAlertDto) {
    const alert = this.alertRepo.create({
      orgId: dto.orgId,
      alertId: uuidv4(),
      alertContext: dto.alertContext,
      status: dto.status || AlertStatus.NEW,
      createdBy: dto.createdBy,
    });
    return this.alertRepo.save(alert);
  }

  async getAlertsByOrg(orgId: string, status?: string) {
    const query = this.alertRepo.createQueryBuilder('alert')
      .where('alert.orgId = :orgId', { orgId })
      .orderBy('alert.createdAt', 'DESC');
    
    if (status) {
      query.andWhere('alert.status = :status', { status });
    }
    
    return query.getMany();
  }

  async updateAlertStatus(id: string, orgId: string, status: AlertStatus, updatedBy: string) {
    const alert = await this.alertRepo.findOne({
      where: { id, orgId },
    });
    if (!alert) {
      throw new Error('Alert not found');
    }
    const previousStatus = alert.status;
    alert.status = status;
    alert.updatedBy = updatedBy;
    await this.alertRepo.save(alert);

    // Create audit event
    await this.createAlertEvent({
      orgId,
      eventData: {
        alertId: alert.id,
        previousStatus,
        newStatus: status,
        changedAt: new Date().toISOString(),
      },
      createdBy: updatedBy,
    });

    return alert;
  }

  async createAlertEvent(dto: CreateAlertEventDto) {
    const event = this.alertEventRepo.create({
      orgId: dto.orgId,
      eventId: uuidv4(),
      eventData: dto.eventData,
      createdBy: dto.createdBy,
    });
    return this.alertEventRepo.save(event);
  }

  async getAlertEventsByAlert(alertId: string, orgId: string) {
    return this.alertEventRepo.find({
      where: {
        orgId,
        eventData: {
          alertId,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }
}
