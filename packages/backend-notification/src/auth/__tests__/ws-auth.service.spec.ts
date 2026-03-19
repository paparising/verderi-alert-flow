import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { WsAuthService } from '../ws-auth.service';
import type { Mocked } from 'vitest';

describe('WsAuthService', () => {
  let service: WsAuthService;
  let jwtService: Mocked<JwtService>;

  beforeEach(() => {
    jwtService = {
      verifyAsync: vi.fn(),
    } as unknown as Mocked<JwtService>;

    const configService = {
      get: vi.fn((_: string, fallback: string) => fallback),
    } as unknown as ConfigService;

    service = new WsAuthService(jwtService, configService);
  });

  it('should authenticate with token from handshake auth', async () => {
    const mockClient = {
      handshake: {
        auth: { token: 'token-123' },
        headers: {},
      },
    } as unknown as Socket;

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      orgId: 'org-1',
      email: 'user@test.com',
      roles: ['user'],
    } as never);

    const result = await service.authenticateClient(mockClient);

    expect(result).toEqual({
      userId: 'user-1',
      orgId: 'org-1',
      email: 'user@test.com',
      roles: ['user'],
    });
  });

  it('should authenticate with token from Authorization header', async () => {
    const mockClient = {
      handshake: {
        auth: {},
        headers: { authorization: 'Bearer token-456' },
      },
    } as unknown as Socket;

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-2',
      orgId: 'org-2',
      roles: [],
    } as never);

    const result = await service.authenticateClient(mockClient);

    expect(result.userId).toBe('user-2');
    expect(result.orgId).toBe('org-2');
  });

  it('should throw when token is missing', async () => {
    const mockClient = {
      handshake: {
        auth: {},
        headers: {},
      },
    } as unknown as Socket;

    await expect(service.authenticateClient(mockClient)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should throw for invalid token payload', async () => {
    const mockClient = {
      handshake: {
        auth: { token: 'token-789' },
        headers: {},
      },
    } as unknown as Socket;

    jwtService.verifyAsync.mockResolvedValue({ sub: '', orgId: '' } as never);

    await expect(service.authenticateClient(mockClient)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});



