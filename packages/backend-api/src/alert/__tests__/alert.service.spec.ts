import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AlertService } from '../alert.service';
import { Alert, AlertEvent, AlertStatus } from '@videri/shared';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import type { Mocked } from 'vitest';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: Mocked<Repository<Alert>>;
  let alertEventRepo: Mocked<Repository<AlertEvent>>;
  let dataSource: Mocked<DataSource>;
  let queryRunner: any;

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
    queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        save: vi.fn().mockResolvedValue(mockAlert),
        findOne: vi.fn().mockResolvedValue(mockAlert),
      },
    };

    const mockAlertRepo = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockAlert]),
        getManyAndCount: vi.fn().mockResolvedValue([[mockAlert], 1]),
      })),
    };

    const mockAlertEventRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
    };

    const mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunner),
    };

    const mockKafka = {
      sendAlertEvent: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getRepositoryToken(Alert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(AlertEvent), useValue: mockAlertEventRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepo = module.get(getRepositoryToken(Alert));
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAlert', () => {
    it('should create an alert and alert event in a transaction', async () => {
      const createDto = {
        orgId: 'org-123',
        alertContext: 'Test alert',
        createdBy: 'user-123',
      };
      alertRepo.create.mockReturnValue(mockAlert as Alert);
      alertEventRepo.create.mockReturnValue({ eventId: 'event-123' } as AlertEvent);
      queryRunner.manager.save.mockResolvedValue(mockAlert as Alert);

      const result = await service.createAlert(createDto);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          alertContext: 'Test alert',
          status: AlertStatus.NEW,
          createdBy: 'user-123',
        }),
      );
      expect(alertEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          alertId: mockAlert.id,
          eventData: expect.objectContaining({
            eventType: 'ALERT_CREATED',
            alertContext: mockAlert.alertContext,
            status: mockAlert.status,
          }),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it('should rollback on error during alert creation', async () => {
      const createDto = {
        orgId: 'org-123',
        alertContext: 'Test alert',
        createdBy: 'user-123',
      };
      const error = new Error('DB Error');
      queryRunner.manager.save.mockRejectedValueOnce(error);

      await expect(service.createAlert(createDto)).rejects.toThrow('DB Error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getAlertsByOrg', () => {
    it('should return alerts for an organization', async () => {
      const result = await service.getAlertsByOrg('org-123');

      expect(result).toEqual([mockAlert]);
    });

    it('should filter by status when provided', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockAlert]),
        getManyAndCount: vi.fn().mockResolvedValue([[mockAlert], 1]),
      };
      alertRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getAlertsByOrg('org-123', AlertStatus.NEW);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('alert.status = :status', { status: AlertStatus.NEW });
    });

    it('should return paginated results with metadata', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockAlert]),
        getManyAndCount: vi.fn().mockResolvedValue([[mockAlert], 23]),
      };
      alertRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.getAlertsByOrgAndCreatorPaginated('org-123', AlertStatus.NEW, 'user-1', 2, 5);

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(result).toEqual({
        data: [mockAlert],
        pagination: {
          page: 2,
          pageSize: 5,
          total: 23,
          totalPages: 5,
        },
      });
    });
  });

  describe('updateAlertStatus', () => {
    it('should update alert status and create event in a transaction', async () => {
      const updatedAlert = { ...mockAlert, status: AlertStatus.ACKNOWLEDGED, version: 2 };
      queryRunner.manager.findOne.mockResolvedValue(mockAlert as Alert);
      queryRunner.manager.save.mockResolvedValue(updatedAlert as Alert);
      alertEventRepo.create.mockReturnValue({ eventId: 'event-456' } as AlertEvent);

      const result = await service.updateAlertStatus('alert-123', 'org-123', AlertStatus.ACKNOWLEDGED, 'user-456');

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(Alert, {
        where: { id: 'alert-123', orgId: 'org-123' },
      });
      expect(alertEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          alertId: 'alert-123',
          eventData: expect.objectContaining({
            eventType: 'ALERT_STATUS_CHANGED',
            previousStatus: AlertStatus.NEW,
            newStatus: AlertStatus.ACKNOWLEDGED,
          }),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
    });

    it('should throw error when alert not found', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.updateAlertStatus('non-existent', 'org-123', AlertStatus.ACKNOWLEDGED, 'user-456'))
        .rejects.toThrow('Alert not found in this organization');
      
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('createAlertEvent', () => {
    it('should create alert event in a transaction', async () => {
      const createDto = {
        orgId: 'org-123',
        alertId: 'alert-123',
        eventData: { key: 'value' },
        createdBy: 'user-123',
      };
      const savedEvent: Partial<AlertEvent> = {
        id: 'event-789',
        ...createDto,
        eventId: 'event-id-123',
        createdAt: new Date(),
      };
      queryRunner.manager.save.mockResolvedValue(savedEvent);
      alertEventRepo.create.mockReturnValue(savedEvent as AlertEvent);

      const result = await service.createAlertEvent(createDto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(alertEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          alertId: 'alert-123',
          eventData: expect.objectContaining({
            eventType: 'ALERT_EVENT_CREATED',
            key: 'value',
          }),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(savedEvent);
    });
  });

  describe('updateAlert', () => {
    it('should update alert and create status change event in a transaction', async () => {
      const updateDto = { status: AlertStatus.RESOLVED };
      queryRunner.manager.findOne.mockResolvedValue(mockAlert as Alert);
      alertEventRepo.create.mockReturnValue({ eventId: 'event-999' } as AlertEvent);
      queryRunner.manager.save.mockResolvedValue({ ...mockAlert, status: AlertStatus.RESOLVED });

      const result = await service.updateAlert('alert-123', 'org-123', 'user-789', updateDto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(alertEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: expect.objectContaining({
            eventType: 'ALERT_STATUS_CHANGED',
          }),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteAlert', () => {
    it('should delete alert and related events', async () => {
      alertRepo.findOne.mockResolvedValue(mockAlert as Alert);
      alertEventRepo.delete = vi.fn().mockResolvedValue({ affected: 2 });
      alertRepo.delete = vi.fn().mockResolvedValue({ affected: 1 });

      const result = await service.deleteAlert('alert-123', 'org-123');

      expect(alertRepo.findOne).toHaveBeenCalledWith({ where: { id: 'alert-123', orgId: 'org-123' } });
      expect(alertEventRepo.delete).toHaveBeenCalledWith({ alertId: 'alert-123', orgId: 'org-123' });
      expect(alertRepo.delete).toHaveBeenCalledWith({ id: 'alert-123', orgId: 'org-123' });
      expect(result).toEqual({ success: true });
    });

    it('should throw error when alert not found', async () => {
      alertRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteAlert('non-existent', 'org-123')).rejects.toThrow(
        'Alert not found in this organization',
      );
    });
  });
});



