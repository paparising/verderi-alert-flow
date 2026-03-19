import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import type { Mocked } from 'vitest';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
    } as unknown as Mocked<AuthService>;

    controller = new AuthController(authService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate login to AuthService', async () => {
    const dto = { email: 'user@test.com', password: 'secret' };
    const expected = { accessToken: 'jwt-token' };
    authService.login.mockResolvedValue(expected as any);

    const result = await controller.login(dto as any);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });
});



