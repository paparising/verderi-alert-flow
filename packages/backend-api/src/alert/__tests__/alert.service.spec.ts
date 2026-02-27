import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertService } from '../alert.service';
import { Alert, AlertEvent, AlertStatus } from '@vederi/shared';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: jest.Mocked<Repository<Alert>>;
  let alertEventRepo: jest.Mocked<Repository<AlertEvent>>;
  let kafkaProducer: jest.Mocked<KafkaProducerService>;

  const mockAlert: Partial<Alert> = {
    id: 'alert-123',
    orgId: 'org-123',
    alertId: 'alert-uuid',
    alertContext: 'Test alert',
    status: AlertStatus.NEW,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAlertRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAlert]),
      })),
    };

    const mockAlertEventRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockKafka = {
      sendAlertEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getRepositoryToken(Alert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(AlertEvent), useValue: mockAlertEventRepo },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepo = module.get(getRepositoryToken(Alert));
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    kafkaProducer = module.get(KafkaProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAlert', () => {
    it('should create an alert and send event to Kafka', async () => {
      const createDto = {
        orgId: 'org-123',
        alertContext: 'Test alert',
        createdBy: 'user-123',
      };
      alertRepo.create.mockReturnValue(mockAlert as Alert);
      alertRepo.save.mockResolvedValue(mockAlert as Alert);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);

      const result = await service.createAlert(createDto);

      expect(alertRepo.create).toHaveBeenCalled();
      expect(alertRepo.save).toHaveBeenCalled();
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledWith(
        'alert-events',
        expect.objectContaining({
          orgId: 'org-123',
          alertId: mockAlert.id,
          eventType: 'ALERT_CREATED',
          eventData: expect.objectContaining({
            alertId: mockAlert.id,
            alertContext: mockAlert.alertContext,
            status: mockAlert.status,
          }),
        }),
      );
      expect(result).toEqual(mockAlert);
    });
  });

  describe('getAlertsByOrg', () => {
    it('should return alerts for an organization', async () => {
      const result = await service.getAlertsByOrg('org-123');

      expect(result).toEqual([mockAlert]);
    });

    it('should filter by status when provided', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAlert]),
      };
      alertRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getAlertsByOrg('org-123', AlertStatus.NEW);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('alert.status = :status', { status: AlertStatus.NEW });
    });
  });

  describe('updateAlertStatus', () => {
    it('should update alert status and send event to Kafka', async () => {
      const updatedAlert = { ...mockAlert, status: AlertStatus.ACKNOWLEDGED, version: 2 };
      alertRepo.findOne.mockResolvedValue(mockAlert as Alert);
      alertRepo.save.mockResolvedValue(updatedAlert as Alert);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);

      const result = await service.updateAlertStatus('alert-123', 'org-123', AlertStatus.ACKNOWLEDGED, 'user-456');

      expect(alertRepo.findOne).toHaveBeenCalledWith({ where: { id: 'alert-123', orgId: 'org-123' } });
      expect(alertRepo.save).toHaveBeenCalled();
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledWith(
        'alert-events',
        expect.objectContaining({
          orgId: 'org-123',
          alertId: 'alert-123',
          eventType: 'ALERT_STATUS_CHANGED',
          eventData: expect.objectContaining({
            alertId: 'alert-123',
            previousStatus: AlertStatus.NEW,
            newStatus: AlertStatus.ACKNOWLEDGED,
          }),
        }),
      );
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
    });

    it('should throw error when alert not found', async () => {
      alertRepo.findOne.mockResolvedValue(null);

      await expect(service.updateAlertStatus('non-existent', 'org-123', AlertStatus.ACKNOWLEDGED, 'user-456'))
        .rejects.toThrow('Alert not found in this organization');
    });

    it('should increment version on update for optimistic locking', async () => {
      const alertWithVersion = { ...mockAlert, version: 1 };
      const updatedAlertWithVersion = { ...mockAlert, status: AlertStatus.RESOLVED, version: 2 };
      alertRepo.findOne.mockResolvedValue(alertWithVersion as Alert);
      alertRepo.save.mockResolvedValue(updatedAlertWithVersion as Alert);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);

      const result = await service.updateAlertStatus('alert-123', 'org-123', AlertStatus.RESOLVED, 'user-789');

      expect(result.version).toBe(2);
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledWith(
        'alert-events',
        expect.objectContaining({
          alertId: 'alert-123',
          eventData: expect.objectContaining({ alertId: 'alert-123' }),
        }),
      );
    });
  });
});
