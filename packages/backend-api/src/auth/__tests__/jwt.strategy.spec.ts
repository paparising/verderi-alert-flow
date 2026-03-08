import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string, defaultValue: string) => defaultValue),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(config);
  });

  it('should map valid payload to request user shape', () => {
    const payload = {
      sub: 'user-1',
      orgId: 'org-1',
      email: 'user@test.com',
      roles: ['admin'],
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      userId: 'user-1',
      orgId: 'org-1',
      email: 'user@test.com',
      roles: ['admin'],
    });
  });

  it('should throw UnauthorizedException for invalid payload', () => {
    expect(() => strategy.validate({ sub: '', orgId: '' })).toThrow(UnauthorizedException);
  });
});
