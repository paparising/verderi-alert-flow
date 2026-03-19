import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../user.service';
import { User, Organization, CreateUserDto, UpdateUserDto } from '@videri/shared';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Mocked, MockInstance } from 'vitest';

describe('UserService', () => {
  let service: UserService;
  let userRepo: Mocked<Repository<User>>;
  let orgRepo: Mocked<Repository<Organization>>;

  const mockOrg: Partial<Organization> = {
    id: 'org-123',
    name: 'Test Org',
  };

  const mockUser: Partial<User> = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    address: '123 Main St',
    role: 'user',
    organization: mockOrg as Organization,
  };

  beforeEach(() => {
    (vi.spyOn(bcrypt, 'hash') as MockInstance).mockResolvedValue('hashed-password');
    Object.assign(mockUser, {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      address: '123 Main St',
      role: 'user',
      organization: mockOrg as Organization,
      passwordHash: undefined,
    });
  });

  beforeEach(async () => {
    const mockUserRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    };

    const mockOrgRepo = {
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepo,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    orgRepo = module.get(getRepositoryToken(Organization));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createForOrg', () => {
    it('should create a user for an organization', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'user',
        password: 'strong-pass',
      };

      orgRepo.findOne.mockResolvedValue(mockOrg as Organization);
      userRepo.create.mockReturnValue({ ...mockUser, passwordHash: 'hashed-password' } as User);
      userRepo.save.mockResolvedValue(mockUser as User);

      const result = await service.createForOrg(createDto, 'org-123');

      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { id: 'org-123' } });
      expect(userRepo.create).toHaveBeenCalledWith({
        name: createDto.name,
        email: createDto.email,
        phone: createDto.phone,
        address: createDto.address,
        role: createDto.role,
        organization: mockOrg,
        passwordHash: 'hashed-password',
      });
      expect(result).toEqual(mockUser);
    });

    it('should create a user with default role if not specified', async () => {
      const createDto: CreateUserDto = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
        address: '456 Oak St',
        password: 'strong-pass',
      };

      const userWithDefaultRole = { ...mockUser, role: 'user' };
      orgRepo.findOne.mockResolvedValue(mockOrg as Organization);
      userRepo.create.mockReturnValue({ ...userWithDefaultRole, passwordHash: 'hashed-password' } as User);
      userRepo.save.mockResolvedValue(userWithDefaultRole as User);

      const result = await service.createForOrg(createDto, 'org-123');

      expect(userRepo.create).toHaveBeenCalledWith({
        name: createDto.name,
        email: createDto.email,
        phone: createDto.phone,
        address: createDto.address,
        role: 'user',
        organization: mockOrg,
        passwordHash: 'hashed-password',
      });
      expect(result.role).toBe('user');
    });

    it('should throw ForbiddenException if organization not found', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'admin',
        password: 'strong-pass',
      };

      orgRepo.findOne.mockResolvedValue(null);

      await expect(service.createForOrg(createDto, 'org-invalid')).rejects.toThrow(ForbiddenException);
      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { id: 'org-invalid' } });
    });
  });

  describe('findAllByOrg', () => {
    it('should return all users in an organization', async () => {
      const users = [mockUser as User];
      userRepo.find.mockResolvedValue(users);

      const result = await service.findAllByOrg('org-123');

      expect(userRepo.find).toHaveBeenCalledWith({
        where: { organization: { id: 'org-123' } },
        relations: ['organization'],
      });
      expect(result).toEqual(users);
    });

    it('should return empty array if no users exist', async () => {
      userRepo.find.mockResolvedValue([]);

      const result = await service.findAllByOrg('org-123');

      expect(result).toEqual([]);
    });
  });

  describe('findOneByOrg', () => {
    it('should return a user by id and org', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findOneByOrg('user-123', 'org-123');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123', organization: { id: 'org-123' } },
        relations: ['organization'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException if user not found in org', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByOrg('user-invalid', 'org-123')).rejects.toThrow(
        'User not found in this organization',
      );
    });
  });

  describe('updateForOrg', () => {
    it('should update user fields', async () => {
      const updateDto: UpdateUserDto = {
        name: 'Jane Doe',
        phone: '9876543210',
        address: '456 Oak St',
      };

      userRepo.findOne.mockResolvedValue(mockUser as User);
      userRepo.save.mockResolvedValue({ ...mockUser, ...updateDto } as User);

      const result = await service.updateForOrg('user-123', 'org-123', updateDto);

      expect(userRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Jane Doe');
      expect(result.phone).toBe('9876543210');
    });

    it('should throw ForbiddenException if organizationId is in update dto', async () => {
      const updateDto: any = {
        name: 'Jane Doe',
        organizationId: 'org-456',
      };

      userRepo.findOne.mockResolvedValue(mockUser as User);

      await expect(service.updateForOrg('user-123', 'org-123', updateDto)).rejects.toThrow(
        'Organization cannot be modified',
      );
    });

    it('should throw ForbiddenException if organization is in update dto', async () => {
      const updateDto: any = {
        name: 'Jane Doe',
        organization: { id: 'org-456' },
      };

      userRepo.findOne.mockResolvedValue(mockUser as User);

      await expect(service.updateForOrg('user-123', 'org-123', updateDto)).rejects.toThrow(
        'Organization cannot be modified',
      );
    });

    it('should throw ConflictException if email is already used', async () => {
      const updateDto: UpdateUserDto = {
        email: 'existing@example.com',
      };

      userRepo.findOne.mockResolvedValueOnce(mockUser as User);
      userRepo.findOne.mockResolvedValueOnce({ id: 'other-user' } as User);

      await expect(service.updateForOrg('user-123', 'org-123', updateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow same email without conflict', async () => {
      const updateDto: UpdateUserDto = {
        email: mockUser.email,
      };

      userRepo.findOne.mockResolvedValue(mockUser as User);
      userRepo.save.mockResolvedValue(mockUser as User);

      const result = await service.updateForOrg('user-123', 'org-123', updateDto);

      expect(userRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should update role', async () => {
      const updateDto: UpdateUserDto = {
        role: 'admin',
      };

      const adminUser = { ...mockUser, role: 'admin' };
      userRepo.findOne.mockResolvedValue(mockUser as User);
      userRepo.save.mockResolvedValue(adminUser as User);

      const result = await service.updateForOrg('user-123', 'org-123', updateDto);

      expect(result.role).toBe('admin');
    });

    it('should hash password when provided', async () => {
      const updateDto: UpdateUserDto = {
        password: 'new-strong-pass',
      };

      const userForTest = { ...mockUser } as User;
      let savedUserArg: any;
      userRepo.findOne.mockResolvedValue(userForTest);
      userRepo.save.mockImplementation(async (u) => {
        savedUserArg = { ...u };
        return { ...u } as User;
      });

      await service.updateForOrg('user-123', 'org-123', updateDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('new-strong-pass', 10);
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(savedUserArg).toBeDefined();
      expect(savedUserArg.passwordHash).toBe('hashed-password');
    });
  });

  describe('deleteForOrg', () => {
    it('should delete a user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as User);
      userRepo.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteForOrg('user-123', 'org-123');

      expect(userRepo.delete).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException if user not found in org', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteForOrg('user-invalid', 'org-123')).rejects.toThrow(
        'User not found in this organization',
      );
    });
  });
});



