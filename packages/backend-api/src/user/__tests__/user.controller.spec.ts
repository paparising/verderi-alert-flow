import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { CreateUserDto, UpdateUserDto } from '@vederi/shared';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  const mockOrg = {
    id: 'org-123',
    name: 'Test Org',
  };

  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    address: '123 Main St',
    role: 'user',
    organization: mockOrg,
  };

  beforeEach(async () => {
    const mockService = {
      createForOrg: jest.fn(),
      findAllByOrg: jest.fn(),
      findOneByOrg: jest.fn(),
      updateForOrg: jest.fn(),
      deleteForOrg: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService) as jest.Mocked<UserService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /users', () => {
    it('should create a user', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'user',
        password: 'strong-pass',
      };

      const req = { user: { orgId: 'org-123', roles: ['admin'] } };
      service.createForOrg.mockResolvedValue(mockUser as any);

      const result = await controller.create(createDto, req);

      expect(service.createForOrg).toHaveBeenCalledWith(createDto, 'org-123');
      expect(result).toEqual(mockUser);
    });

    it('should allow superadmin to create user for a different org', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'admin',
        password: 'strong-pass',
        organizationId: 'org-456',
      };

      const req = { user: { orgId: 'org-123', roles: ['superadmin'] } };
      service.createForOrg.mockResolvedValue(mockUser as any);

      const result = await controller.create(createDto, req);

      expect(service.createForOrg).toHaveBeenCalledWith(createDto, 'org-456');
      expect(result).toEqual(mockUser);
    });

    it('should use own org if superadmin does not provide organizationId', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'user',
        password: 'strong-pass',
      };

      const req = { user: { orgId: 'org-123', roles: ['superadmin'] } };
      service.createForOrg.mockResolvedValue(mockUser as any);

      const result = await controller.create(createDto, req);

      expect(service.createForOrg).toHaveBeenCalledWith(createDto, 'org-123');
      expect(result).toEqual(mockUser);
    });

    it('should ignore organizationId for non-superadmin users', async () => {
      const createDto: CreateUserDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        role: 'user',
        password: 'strong-pass',
        organizationId: 'org-456',
      };

      const req = { user: { orgId: 'org-123', roles: ['admin'] } };
      service.createForOrg.mockResolvedValue(mockUser as any);

      const result = await controller.create(createDto, req);

      // Should use admin's org, not the specified one
      expect(service.createForOrg).toHaveBeenCalledWith(createDto, 'org-123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('GET /users', () => {
    it('should return all users in organization', async () => {
      const req = { user: { orgId: 'org-123' } };
      const users = [mockUser];
      service.findAllByOrg.mockResolvedValue(users as any);

      const result = await controller.findAll(req);

      expect(service.findAllByOrg).toHaveBeenCalledWith('org-123');
      expect(result).toEqual(users);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user by id', async () => {
      const req = { user: { orgId: 'org-123' } };
      service.findOneByOrg.mockResolvedValue(mockUser as any);

      const result = await controller.findOne('user-123', req);

      expect(service.findOneByOrg).toHaveBeenCalledWith('user-123', 'org-123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update a user', async () => {
      const updateDto: UpdateUserDto = {
        name: 'Jane Doe',
      };

      const req = { user: { orgId: 'org-123' } };
      const updatedUser = { ...mockUser, name: 'Jane Doe' };
      service.updateForOrg.mockResolvedValue(updatedUser as any);

      const result = await controller.update('user-123', updateDto, req);

      expect(service.updateForOrg).toHaveBeenCalledWith('user-123', 'org-123', updateDto);
      expect(result).toEqual(updatedUser);
    });

    it('should not allow changing organization', async () => {
      const updateDto: any = {
        name: 'Jane Doe',
        organizationId: 'org-456',
      };

      const req = { user: { orgId: 'org-123' } };
      const error = new Error('Organization cannot be modified');
      service.updateForOrg.mockRejectedValue(error);

      await expect(controller.update('user-123', updateDto, req)).rejects.toThrow(
        'Organization cannot be modified',
      );
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete a user', async () => {
      const req = { user: { orgId: 'org-123' } };
      service.deleteForOrg.mockResolvedValue({ success: true });

      const result = await controller.delete('user-123', req);

      expect(service.deleteForOrg).toHaveBeenCalledWith('user-123', 'org-123');
      expect(result).toEqual({ success: true });
    });
  });
});
