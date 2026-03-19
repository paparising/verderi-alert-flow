import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import type { Mocked } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let users: Mocked<UserService>;
  let jwt: Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    email: 'user@test.com',
    role: 'admin',
    passwordHash: 'hashed',
    organization: { id: 'org-1' },
  };

  beforeEach(() => {
    users = {
      findByEmailWithPassword: vi.fn(),
    } as unknown as Mocked<UserService>;

    jwt = {
      signAsync: vi.fn(),
    } as unknown as Mocked<JwtService>;

    service = new AuthService(users, jwt);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateUser', () => {
    it('should return user for valid credentials', async () => {
      users.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.validateUser('user@test.com', 'secret');

      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('user@test.com');
      expect(result).toBe(mockUser);
    });

    it('should throw UnauthorizedException when user is missing', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null as any);

      await expect(service.validateUser('missing@test.com', 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      users.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.validateUser('user@test.com', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      users.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jwt.signAsync.mockResolvedValue('jwt-token' as never);

      const result = await service.login({ email: 'user@test.com', password: 'secret' } as any);

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        orgId: 'org-1',
        email: 'user@test.com',
        roles: ['admin'],
      });
      expect(result).toEqual({ accessToken: 'jwt-token' });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      users.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login({ email: 'user@test.com', password: 'wrong' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});



