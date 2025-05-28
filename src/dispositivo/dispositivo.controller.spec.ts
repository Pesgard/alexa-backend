import { Test, TestingModule } from '@nestjs/testing';
import { DispositivoController } from './dispositivo.controller';
import { DispositivoService } from './dispositivo.service';

describe('DispositivoController', () => {
  let controller: DispositivoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispositivoController],
      providers: [DispositivoService],
    }).compile();

    controller = module.get<DispositivoController>(DispositivoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
