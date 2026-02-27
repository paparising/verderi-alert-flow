import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message', () => {
      const result = controller.getHello();
      expect(result).toBe('Videri Alert Flow API Service');
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const result = controller.getHealth();
      
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('service', 'backend-api');
    });

    it('should return valid ISO timestamp', () => {
      const result = controller.getHealth();
      const timestamp = new Date(result.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });
});
