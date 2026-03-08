import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  it('should allow access for @Public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true as never);
    const context = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access in NODE_ENV=test', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    reflector.getAllAndOverride.mockReturnValue(false as never);
    const context = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    process.env.NODE_ENV = original;
  });
});
