import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertService } from '../alert.service';
import { Alert, AlertEvent, AlertStatus } from '@vederi/shared';
import { AlertGateway } from '../alert.gateway';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: jest.Mocked<Repository<Alert>>;
  let alertEventRepo: jest.Mocked<Repository<AlertEvent>>;
  let alertGateway: jest.Mocked<AlertGateway>;
  let kafkaProducer: jest.Mocked<KafkaProducerService>;

  const mockAlert: Partial<Alert> = {
    id: 'alert-123',
    orgId: 'org-123',
    alertId: 'alert-uuid',
    alertContext: 'Test alert',
    status: AlertStatus.NEW,
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

    const mockGateway = {
      emitNewAlert: jest.fn(),
      emitAlertStatusUpdate: jest.fn(),
    };

    const mockKafka = {
      sendAlertEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getRepositoryToken(Alert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(AlertEvent), useValue: mockAlertEventRepo },
        { provide: AlertGateway, useValue: mockGateway },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepo = module.get(getRepositoryToken(Alert));
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    alertGateway = module.get(AlertGateway);
    kafkaProducer = module.get(KafkaProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAlert', () => {
    it('should create an alert and emit websocket event', async () => {
      const createDto = {
        orgId: 'org-123',
        alertContext: 'Test alert',
        createdBy: 'user-123',
      };
      alertRepo.create.mockReturnValue(mockAlert as Alert);
      alertRepo.save.mockResolvedValue(mockAlert as Alert);

      const result = await service.createAlert(createDto);

      expect(alertRepo.create).toHaveBeenCalled();
      expect(alertRepo.save).toHaveBeenCalled();
      expect(alertGateway.emitNewAlert).toHaveBeenCalledWith('org-123', mockAlert);
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
});
