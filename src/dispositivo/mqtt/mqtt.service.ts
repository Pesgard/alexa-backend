import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { DispositivoService } from '../dispositivo.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private dispositivoService: DispositivoService; // Se inyectará después para evitar dependencia circular

  // Configuración MQTT
  private readonly mqttConfig = {
    host: process.env.MQTT_HOST || 'broker.hivemq.com', // Broker público gratuito
    port: parseInt(process.env.MQTT_PORT || '1883'),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: `nestjs_server_${Math.random().toString(16).substr(2, 8)}`
  };

  // Topics MQTT
  private readonly topics = {
    comando: 'casa/foco/comando',        // Backend → ESP32
    estado: 'casa/foco/estado',          // ESP32 → Backend
    heartbeat: 'casa/foco/heartbeat',    // ESP32 → Backend (keep alive)
    status: 'casa/foco/status'           // Backend → ESP32 (confirmación)
  };

  async onModuleInit() {
    await this.connectMqtt();
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  private async connectMqtt() {
    try {
      const brokerUrl = `mqtt://${this.mqttConfig.host}:${this.mqttConfig.port}`;
      
      this.client = mqtt.connect(brokerUrl, {
        clientId: this.mqttConfig.clientId,
        username: this.mqttConfig.username || undefined,
        password: this.mqttConfig.password || undefined,
        clean: true,
        reconnectPeriod: 5000,
        keepalive: 60
      });

      this.client.on('connect', () => {
        this.logger.log(`✅ Conectado al broker MQTT: ${brokerUrl}`);
        this.subscribeToTopics();
      });

      this.client.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message.toString());
      });

      this.client.on('error', (error) => {
        this.logger.error(`❌ Error MQTT: ${error.message}`);
      });

      this.client.on('disconnect', () => {
        this.logger.warn('🔌 Desconectado del broker MQTT');
      });

      this.client.on('reconnect', () => {
        this.logger.log('🔄 Reconectando al broker MQTT...');
      });

    } catch (error) {
      this.logger.error('Error al conectar MQTT:', error);
    }
  }

  private subscribeToTopics() {
    // Suscribirse a los topics de ESP32
    this.client.subscribe([
      this.topics.estado,
      this.topics.heartbeat
    ], (err) => {
      if (err) {
        this.logger.error('Error al suscribirse a topics:', err);
      } else {
        this.logger.log(`📡 Suscrito a topics: ${this.topics.estado}, ${this.topics.heartbeat}`);
      }
    });
  }

  private handleMqttMessage(topic: string, message: string) {
    this.logger.log(`📥 Mensaje MQTT recibido en ${topic}: ${message}`);

    try {
      const payload = JSON.parse(message);

      switch (topic) {
        case this.topics.estado:
          this.handleEstadoMessage(payload);
          break;
        
        case this.topics.heartbeat:
          this.handleHeartbeatMessage(payload);
          break;
      }
    } catch (error) {
      this.logger.error('Error al procesar mensaje MQTT:', error);
    }
  }

  private handleEstadoMessage(payload: any) {
    if (this.dispositivoService) {
      this.dispositivoService.actualizarEstadoDesdeESP32(payload, payload.esp32Id || 'unknown');
    }
  }

  private handleHeartbeatMessage(payload: any) {
    this.logger.log(`💓 Heartbeat recibido de ESP32: ${payload.esp32Id}`);
    if (this.dispositivoService) {
      this.dispositivoService.registrarESP32(payload.esp32Id);
    }
  }

  // Método para enviar comandos al ESP32
  enviarComandoAESP32(estado: string, timestamp?: string) {
    const comando = {
      estado,
      timestamp: timestamp || new Date().toISOString(),
      origen: 'backend'
    };

    this.client.publish(this.topics.comando, JSON.stringify(comando), { qos: 1 }, (err) => {
      if (err) {
        this.logger.error('Error al enviar comando MQTT:', err);
      } else {
        this.logger.log(`📤 Comando enviado via MQTT: ${estado}`);
      }
    });
  }

  // Método para enviar confirmación de status
  enviarStatus(mensaje: string) {
    const status = {
      mensaje,
      timestamp: new Date().toISOString(),
      servidor: 'nestjs'
    };

    this.client.publish(this.topics.status, JSON.stringify(status), { qos: 0 });
  }

  // Inyectar referencia al servicio de foco (para evitar dependencia circular)
  setDispositivoService(dispositivoService: DispositivoService) {
    this.dispositivoService = dispositivoService;
  }

  // Método para verificar conexión
  isConnected(): boolean {
    return this.client && this.client.connected;
  }

  // Obtener estadísticas
  getStats() {
    return {
      connected: this.isConnected(),
      clientId: this.mqttConfig.clientId,
      broker: `${this.mqttConfig.host}:${this.mqttConfig.port}`,
      topics: this.topics
    };
  }
}