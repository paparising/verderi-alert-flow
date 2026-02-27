import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationService } from '../organization.service';
import { Organization } from '@videri/shared';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repo: jest.Mocked<Repository<Organization>>;

  const mockOrg: Partial<Organization> = {
    id: 'org-123',
    name: 'Test Org',
    address: '123 Test St',
    contact: 'test@example.com',
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    repo = module.get(getRepositoryToken(Organization));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const createDto = { name: 'Test Org', address: '123 Test St', contact: 'test@example.com' };
      repo.create.mockReturnValue(mockOrg as Organization);
      repo.save.mockResolvedValue(mockOrg as Organization);

      const result = await service.create(createDto);

      expect(repo.create).toHaveBeenCalledWith(createDto);
      expect(repo.save).toHaveBeenCalledWith(mockOrg);
      expect(result).toEqual(mockOrg);
    });
  });

  describe('findAll', () => {
    it('should return all organizations with users', async () => {
      const orgs = [mockOrg as Organization];
      repo.find.mockResolvedValue(orgs);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ relations: ['users'] });
      expect(result).toEqual(orgs);
    });
  });

  describe('findOne', () => {
    it('should return an organization by id', async () => {
      repo.findOne.mockResolvedValue(mockOrg as Organization);

      const result = await service.findOne('org-123');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        relations: ['users'],
      });
      expect(result).toEqual(mockOrg);
    });

    it('should return null if organization not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });
});
