import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertEvent, CreateAlertDto, CreateAlertEventDto, AlertStatus } from '@vederi/shared';
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
    const updatedAlert = await this.alertRepo.save(alert);

    // Send event to Kafka - consumer will handle persistence and WebSocket notification
    const eventData = {
      orgId,
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
        eventData: {
          alertId,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }
}
