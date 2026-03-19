import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../jwt-auth.guard';
import type { Mocked } from 'vitest';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  it('should allow access for @Public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true as never);
    const context = { getHandler: vi.fn(), getClass: vi.fn() } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access in NODE_ENV=test', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    reflector.getAllAndOverride.mockReturnValue(false as never);
    const context = { getHandler: vi.fn(), getClass: vi.fn() } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    process.env.NODE_ENV = original;
  });
});



