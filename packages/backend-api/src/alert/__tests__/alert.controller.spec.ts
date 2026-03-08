import { AlertController } from '../alert.controller';
import { AlertService } from '../alert.service';
import { AlertStatus, CreateAlertDto, UpdateAlertDto, UpdateAlertStatusDto } from '@videri/shared';

describe('AlertController', () => {
  let controller: AlertController;
  let alertService: jest.Mocked<AlertService>;

  beforeEach(() => {
    alertService = {
      createAlert: jest.fn(),
      getAlertsByOrgAndCreator: jest.fn(),
      updateAlertStatus: jest.fn(),
      updateAlert: jest.fn(),
      deleteAlert: jest.fn(),
      getAlertEventsByAlert: jest.fn(),
    } as unknown as jest.Mocked<AlertService>;

    controller = new AlertController(alertService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAlert', () => {
    it('should merge req user org and creator into dto', async () => {
      const dto = {
        alertContext: 'Disk threshold breached',
        status: AlertStatus.NEW,
      } as CreateAlertDto;
      const req = { user: { orgId: 'org-1', userId: 'user-1' } };
      const expected = { id: 'a-1' };

      alertService.createAlert.mockResolvedValue(expected as any);

      const result = await controller.createAlert(dto, req);

      expect(alertService.createAlert).toHaveBeenCalledWith({
        ...dto,
        orgId: 'org-1',
        createdBy: 'user-1',
      });
      expect(result).toBe(expected);
    });
  });

  describe('listAlerts', () => {
    it('should use authenticated org and mine=true creator filter', async () => {
      const req = { user: { orgId: 'org-auth', userId: 'user-auth' } };
      const expected = [{ id: 'a-1' }];
      alertService.getAlertsByOrgAndCreator.mockResolvedValue(expected as any);

      const result = await controller.listAlerts('org-query', AlertStatus.NEW, 'true', req);

      expect(alertService.getAlertsByOrgAndCreator).toHaveBeenCalledWith('org-auth', AlertStatus.NEW, 'user-auth');
      expect(result).toBe(expected);
    });

    it('should fallback to query org when request user is missing', async () => {
      alertService.getAlertsByOrgAndCreator.mockResolvedValue([] as any);

      await controller.listAlerts('org-query', undefined, undefined, undefined);

      expect(alertService.getAlertsByOrgAndCreator).toHaveBeenCalledWith('org-query', undefined, undefined);
    });
  });

  describe('updateAlertStatus', () => {
    it('should forward id, org, status and updatedBy', async () => {
      const dto = { status: AlertStatus.ACKNOWLEDGED } as UpdateAlertStatusDto;
      const req = { user: { orgId: 'org-1', userId: 'user-2' } };
      const expected = { id: 'a-1', status: AlertStatus.ACKNOWLEDGED };
      alertService.updateAlertStatus.mockResolvedValue(expected as any);

      const result = await controller.updateAlertStatus('a-1', dto, req);

      expect(alertService.updateAlertStatus).toHaveBeenCalledWith('a-1', 'org-1', AlertStatus.ACKNOWLEDGED, 'user-2');
      expect(result).toBe(expected);
    });
  });

  describe('updateAlert', () => {
    it('should forward update payload and user context', async () => {
      const dto = { alertContext: 'Updated context' } as UpdateAlertDto;
      const req = { user: { orgId: 'org-1', userId: 'user-3' } };
      const expected = { id: 'a-1' };
      alertService.updateAlert.mockResolvedValue(expected as any);

      const result = await controller.updateAlert('a-1', dto, req);

      expect(alertService.updateAlert).toHaveBeenCalledWith('a-1', 'org-1', 'user-3', dto);
      expect(result).toBe(expected);
    });
  });

  describe('deleteAlert', () => {
    it('should forward id and organization', async () => {
      const req = { user: { orgId: 'org-1' } };
      const expected = { success: true };
      alertService.deleteAlert.mockResolvedValue(expected as any);

      const result = await controller.deleteAlert('a-1', req);

      expect(alertService.deleteAlert).toHaveBeenCalledWith('a-1', 'org-1');
      expect(result).toBe(expected);
    });
  });

  describe('listAlertEvents', () => {
    it('should use authenticated org when available', async () => {
      const req = { user: { orgId: 'org-auth' } };
      const expected = [{ eventId: 'e-1' }];
      alertService.getAlertEventsByAlert.mockResolvedValue(expected as any);

      const result = await controller.listAlertEvents('a-1', 'org-query', req);

      expect(alertService.getAlertEventsByAlert).toHaveBeenCalledWith('a-1', 'org-auth');
      expect(result).toBe(expected);
    });

    it('should fallback to query org for events when request user is missing', async () => {
      alertService.getAlertEventsByAlert.mockResolvedValue([] as any);

      await controller.listAlertEvents('a-1', 'org-query', undefined as any);

      expect(alertService.getAlertEventsByAlert).toHaveBeenCalledWith('a-1', 'org-query');
    });
  });
});
