import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DispositivoDto, EstadoDispositivoDto } from './dto/dispositivo.dto';
import { MqttService } from './mqtt/mqtt.service';

@Injectable()
export class DispositivoService implements OnModuleInit {
  private readonly logger = new Logger(DispositivoService.name);
  private estadoActual: string = 'off';
  private ultimaActualizacion: Date = new Date();

  // Lista de ESP32s conectados (basado en heartbeat)
  private esp32sConectados: Map<string, Date> = new Map();

  constructor(private readonly mqttService: MqttService) {}

  onModuleInit() {
    this.mqttService.setDispositivoService(this);
  }

  async controlarDispositivo(dto: DispositivoDto) {
    const { estado, timestamp } = dto;

    this.logger.log(`🎤 Comando recibido de Alexa: ${estado}`);

    // Actualizar estado interno
    this.estadoActual = estado;
    this.ultimaActualizacion = timestamp ? new Date(timestamp) : new Date();

    // Enviar comando via MQTT al ESP32
    this.mqttService.enviarComandoAESP32(estado, timestamp);

    return {
      success: true,
      mensaje: `Foco ${estado === 'on' ? 'encendido' : 'apagado'}`,
      estado: this.estadoActual,
      timestamp: this.ultimaActualizacion.toISOString(),
      esp32sConectados: this.esp32sConectados.size,
      mqttConnected: this.mqttService.isConnected(),
    };
  }

  getEstadoDispositivo(): EstadoDispositivoDto {
    return {
      estado: this.estadoActual,
      timestamp: this.ultimaActualizacion.toISOString(),
      esp32sConectados: this.esp32sConectados.size,
    };
  }

  // Actualizar estado desde ESP32
  actualizarEstadoDesdeESP32(
    estadoDispositivoDto: EstadoDispositivoDto,
    esp32Id: string,
  ) {
    const { estado, timestamp } = estadoDispositivoDto;

    this.logger.log(`🔧 Estado actualizado desde ESP32 ${esp32Id}: ${estado}`);

    this.estadoActual = estado;
    this.ultimaActualizacion = timestamp ? new Date(timestamp) : new Date();

    // Confirmar recepción
    this.mqttService.enviarStatus(
      `Estado ${estado} confirmado desde ${esp32Id}`,
    );

    return {
      success: true,
      mensaje: 'Estado actualizado correctamente',
      estado: this.estadoActual,
    };
  }

  // Registrar ESP32 conectado (basado en heartbeat)
  registrarESP32(esp32Id: string) {
    this.esp32sConectados.set(esp32Id, new Date());
    this.logger.log(
      `📱 ESP32 activo: ${esp32Id}. Total: ${this.esp32sConectados.size}`,
    );
  }

   // Limpiar ESP32s que no han enviado heartbeat en 5 minutos
   private limpiarESP32sInactivos() {
    const ahora = new Date();
    const timeout = 5 * 60 * 1000; // 5 minutos

    for (const [esp32Id, ultimoHeartbeat] of this.esp32sConectados.entries()) {
      if (ahora.getTime() - ultimoHeartbeat.getTime() > timeout) {
        this.esp32sConectados.delete(esp32Id);
        this.logger.warn(`⚠️ ESP32 ${esp32Id} removido por inactividad`);
      }
    }
  }

   // Obtener estadísticas
   getEstadisticas() {
    return {
      estadoFoco: this.estadoActual,
      ultimaActualizacion: this.ultimaActualizacion.toISOString(),
      esp32sConectados: Array.from(this.esp32sConectados.keys()),
      totalESP32s: this.esp32sConectados.size,
      mqtt: this.mqttService.getStats()
    };
  }
}
