import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from '../organization.controller';
import { OrganizationService } from '../organization.service';
import { SuperAdminGuard } from '../../guards';
import { ConfigService } from '@nestjs/config';
import type { Mocked } from 'vitest';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: Mocked<OrganizationService>;

  const mockOrg = {
    id: 'org-123',
    name: 'Test Org',
    address: '123 Test St',
    contact: 'test@example.com',
  };

  beforeEach(async () => {
    const mockService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        {
          provide: OrganizationService,
          useValue: mockService,
        },
        {
          provide: SuperAdminGuard,
          useValue: { canActivate: vi.fn().mockReturnValue(true) },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
    service = module.get(OrganizationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const createDto = { name: 'Test Org', address: '123 Test St', contact: 'test@example.com' };
      service.create.mockResolvedValue(mockOrg as any);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockOrg);
    });
  });

  describe('findAll', () => {
    it('should return all organizations', async () => {
      service.findAll.mockResolvedValue([mockOrg as any]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockOrg]);
    });
  });

  describe('findOne', () => {
    it('should return an organization by id', async () => {
      service.findOne.mockResolvedValue(mockOrg as any);

      const result = await controller.findOne('org-123');

      expect(service.findOne).toHaveBeenCalledWith('org-123');
      expect(result).toEqual(mockOrg);
    });
  });
});



