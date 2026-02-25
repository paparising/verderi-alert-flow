import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertEvent, CreateAlertDto, CreateAlertEventDto, AlertStatus, UpdateAlertDto } from '@vederi/shared';
import { AlertGateway } from './alert.gateway';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
    private alertGateway: AlertGateway,
    private kafkaProducer: KafkaProducerService,
  ) {}

  async createAlert(dto: CreateAlertDto) {
    const alert = this.alertRepo.create({
      orgId: dto.orgId,
      alertId: uuidv4(),
      alertContext: dto.alertContext,
      status: dto.status || AlertStatus.NEW,
      createdBy: dto.createdBy,
    });
    const savedAlert = await this.alertRepo.save(alert);
    
    // Emit WebSocket event for new alert
    this.alertGateway.emitNewAlert(dto.orgId, savedAlert);
    
    return savedAlert;
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

  async updateAlertStatus(id: string, orgId: string, status: AlertStatus, updatedBy: string) {
    const alert = await this.alertRepo.findOne({
      where: { id, orgId },
    });
    if (!alert) {
      throw new ForbiddenException('Alert not found in this organization');
    }
    const previousStatus = alert.status;
    alert.status = status;
    alert.updatedBy = updatedBy;
    const updatedAlert = await this.alertRepo.save(alert);

    // Send event to Kafka - consumer will handle persistence and WebSocket notification
    const eventData = {
      orgId,
      alertId: alert.id,
      eventId: uuidv4(),
      eventData: {
        alertId: alert.id,
        previousStatus,
        newStatus: status,
        changedAt: new Date().toISOString(),
      },
      createdBy: updatedBy,
    };

    await this.kafkaProducer.sendAlertEvent('alert-events', eventData);

    // Emit WebSocket for alert status update (real-time)
    this.alertGateway.emitAlertStatusUpdate(orgId, updatedAlert);

    return updatedAlert;
  }

  async createAlertEvent(dto: CreateAlertEventDto) {
    // Send to Kafka instead of directly saving
    const eventData = {
      orgId: dto.orgId,
      alertId: dto.alertId,
      eventId: uuidv4(),
      eventData: dto.eventData,
      createdBy: dto.createdBy,
    };
    
    await this.kafkaProducer.sendAlertEvent('alert-events', eventData);
    return eventData;
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
    const alert = await this.alertRepo.findOne({ where: { id, orgId } });
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

    const updatedAlert = await this.alertRepo.save(alert);

    if (statusChanged) {
      const eventData = {
        orgId,
        alertId: alert.id,
        eventId: uuidv4(),
        eventData: {
          alertId: alert.id,
          previousStatus,
          newStatus: nextStatus,
          changedAt: new Date().toISOString(),
        },
        createdBy: updatedBy,
      };
      await this.kafkaProducer.sendAlertEvent('alert-events', eventData);
      this.alertGateway.emitAlertStatusUpdate(orgId, updatedAlert);
    } else if (contextChanged) {
      // emit updated alert so clients can refresh content
      this.alertGateway.emitAlertStatusUpdate(orgId, updatedAlert);
    }

    return updatedAlert;
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
