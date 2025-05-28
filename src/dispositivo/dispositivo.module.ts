import { Module } from '@nestjs/common';
import { DispositivoService } from './dispositivo.service';
import { DispositivoController } from './dispositivo.controller';
import { MqttService } from './mqtt/mqtt.service';

@Module({
  controllers: [DispositivoController],
  providers: [DispositivoService, MqttService],
})
export class DispositivoModule {}
