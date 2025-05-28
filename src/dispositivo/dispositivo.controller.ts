import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { DispositivoService } from './dispositivo.service';
import { DispositivoDto, EstadoDispositivoDto } from './dto/dispositivo.dto';
import { MqttService } from './mqtt/mqtt.service';

@Controller('api')
export class DispositivoController {
  private readonly logger = new Logger(DispositivoController.name);

  constructor(
    private readonly dispositivoService: DispositivoService,
    private readonly mqttService: MqttService,
  ) {}

  @Post('dispositivo')
  async controlarDispositivo(@Body() dto: DispositivoDto) {
    try {
      this.logger.log(`🎤 Petición de Alexa: ${JSON.stringify(dto)}`);

      // Verificar conexión MQTT
      if (!this.mqttService.isConnected()) {
        throw new HttpException(
          'Servidor MQTT no disponible',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const resultado = await this.dispositivoService.controlarDispositivo(dto);
      return resultado;
    } catch (error) {
      this.logger.error('Error al controlar foco:', error);
      throw new HttpException(
        error.message || 'Error interno del servidor',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('dispositivo/estado')
  getEstadoDispositivo() {
    return this.dispositivoService.getEstadoDispositivo();
  }

  @Get('dispositivo/estadisticas')
  getEstadisticas() {
    return this.dispositivoService.getEstadisticas();
  }

   // Endpoint de salud del sistema
   @Get('health')
   getHealth() {
     const stats = this.dispositivoService.getEstadisticas();
     
     return {
       status: 'ok',
       timestamp: new Date().toISOString(),
       service: 'Dispositivo Controller MQTT',
       mqtt: {
         connected: this.mqttService.isConnected(),
         broker: stats.mqtt.broker
       },
       esp32s: stats.totalESP32s,
       estadoFoco: stats.estadoFoco
     };
   }

   // Endpoint manual para testing - Enviar comando directo
  @Post('dispositivo/test/:estado')
  async testComando(@Param('estado') estado: string) {
    if (!['on', 'off'].includes(estado)) {
      throw new HttpException('Estado debe ser "on" o "off"', HttpStatus.BAD_REQUEST);
    }

    this.mqttService.enviarComandoAESP32(estado);
    
    return {
      success: true,
      mensaje: `Comando de test enviado: ${estado}`,
      timestamp: new Date().toISOString()
    };
  }
}
