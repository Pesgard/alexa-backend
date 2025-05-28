import { Test, TestingModule } from '@nestjs/testing';
import { DispositivoService } from './dispositivo.service';

describe('DispositivoService', () => {
  let service: DispositivoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DispositivoService],
    }).compile();

    service = module.get<DispositivoService>(DispositivoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
