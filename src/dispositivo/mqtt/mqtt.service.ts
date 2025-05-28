import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { DispositivoService } from '../dispositivo.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private dispositivoService: DispositivoService; // Se inyectará después para evitar dependencia circular

  // Configuración MQTT basada en la documentación de EMQX
  private readonly mqttConfig = {
    host: process.env.MQTT_HOST || 'broker.emqx.io',
    port: parseInt(process.env.MQTT_PORT || '1883'),
    protocol: (process.env.MQTT_USE_SSL === 'true' || process.env.MQTT_PORT === '8883') ? 'mqtts' : 'mqtt',
    username: process.env.MQTT_USERNAME || 'emqx_test',
    password: process.env.MQTT_PASSWORD || 'emqx_test',
    clientId: `emqx_nestjs_${Math.random().toString(16).substring(2, 8)}`,
  };

  // Topics MQTT
  private readonly topics = {
    comando: 'casa/foco/comando', // Backend → ESP32
    estado: 'casa/foco/estado', // ESP32 → Backend
    heartbeat: 'casa/foco/heartbeat', // ESP32 → Backend (keep alive)
    status: 'casa/foco/status', // Backend → ESP32 (confirmación)
  };

  async onModuleInit() {
    await this.connectMqtt();
  }

  onModuleDestroy() {
    if (this.client && this.client.connected) {
      try {
        this.client.end(false, () => {
          this.logger.log('🔌 Desconectado exitosamente del broker MQTT');
        });
      } catch (error) {
        this.logger.error('Error al desconectar MQTT:', error);
      }
    }
  }

  private async connectMqtt() {
    try {
      this.logger.log(`🔗 Conectando a EMQX Broker...`);
      this.logger.log(`🏠 Host: ${this.mqttConfig.host}`);
      this.logger.log(`🔌 Puerto: ${this.mqttConfig.port}`);
      this.logger.log(`🔒 Protocolo: ${this.mqttConfig.protocol}`);
      this.logger.log(`👤 Usuario: ${this.mqttConfig.username}`);
      this.logger.log(`🆔 Client ID: ${this.mqttConfig.clientId}`);

      // Configuración basada en la documentación de EMQX
      const connectionString = `${this.mqttConfig.protocol}://${this.mqttConfig.host}:${this.mqttConfig.port}`;
      
      const options = {
        clientId: this.mqttConfig.clientId,
        username: this.mqttConfig.username,
        password: this.mqttConfig.password,
        clean: true,
        reconnectPeriod: 5000,
        keepalive: 60,
        connectTimeout: 30000,
      };

      this.logger.log(`🚀 Iniciando conexión MQTT...`);
      this.logger.log(`🔗 Connection String: ${connectionString}`);
      this.logger.log(`📋 Opciones:`, {
        clientId: options.clientId,
        username: options.username,
        clean: options.clean,
        ssl: this.mqttConfig.protocol === 'mqtts',
      });

      // Conectar usando el formato de EMQX (como en la documentación)
      this.client = mqtt.connect(connectionString, options);

      // Event handlers (como en la documentación de EMQX)
      this.client.on('connect', () => {
        this.logger.log(`✅ CONECTADO exitosamente a EMQX Broker!`);
        this.logger.log(`📡 Broker: ${connectionString}`);
        this.subscribeToTopics();
      });

      this.client.on('error', (error) => {
        this.logger.error(`❌ ERROR MQTT: ${error.message}`);
        this.logger.error(`🔍 Detalles:`, error);
      });

      this.client.on('message', (topic, payload) => {
        this.logger.log(`📥 Mensaje recibido en '${topic}': ${payload.toString()}`);
        this.handleMqttMessage(topic, payload.toString());
      });

      this.client.on('disconnect', () => {
        this.logger.warn('🔌 Desconectado del broker MQTT');
      });

      this.client.on('reconnect', () => {
        this.logger.log('🔄 Reconectando al broker MQTT...');
      });

      this.client.on('close', () => {
        this.logger.warn('🚪 Conexión MQTT cerrada');
      });

      this.client.on('offline', () => {
        this.logger.warn('📴 Cliente MQTT offline');
      });

    } catch (error) {
      this.logger.error('💥 Error al conectar MQTT:', error);
    }
  }

  private subscribeToTopics() {
    const topicsToSubscribe = [this.topics.estado, this.topics.heartbeat];
    
    topicsToSubscribe.forEach(topic => {
      const qos = 0; // Como en la documentación de EMQX
      
      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          this.logger.error(`❌ Error al suscribirse a '${topic}':`, error);
          return;
        }
        this.logger.log(`📡 Suscrito exitosamente a topic '${topic}'`);
      });
    });
  }

  private handleMqttMessage(topic: string, message: string) {
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
      this.dispositivoService.actualizarEstadoDesdeESP32(
        payload,
        payload.esp32Id || 'unknown',
      );
    }
  }

  private handleHeartbeatMessage(payload: any) {
    this.logger.log(`💓 Heartbeat recibido de ESP32: ${payload.esp32Id}`);
    if (this.dispositivoService) {
      this.dispositivoService.registrarESP32(payload.esp32Id);
    }
  }

  // Método para enviar comandos al ESP32 (como en la documentación de EMQX)
  enviarComandoAESP32(estado: string, timestamp?: string) {
    const topic = this.topics.comando;
    const payload = JSON.stringify({
      estado,
      timestamp: timestamp || new Date().toISOString(),
      origen: 'backend',
    });
    const qos = 0; // Como en la documentación

    this.client.publish(topic, payload, { qos }, (error) => {
      if (error) {
        this.logger.error('❌ Error al enviar comando MQTT:', error);
      } else {
        this.logger.log(`📤 Comando enviado a '${topic}': ${estado}`);
      }
    });
  }

  // Método para enviar confirmación de status
  enviarStatus(mensaje: string) {
    const topic = this.topics.status;
    const payload = JSON.stringify({
      mensaje,
      timestamp: new Date().toISOString(),
      servidor: 'nestjs',
    });
    const qos = 0;

    this.client.publish(topic, payload, { qos }, (error) => {
      if (error) {
        this.logger.error('❌ Error al enviar status:', error);
      } else {
        this.logger.log(`📤 Status enviado a '${topic}': ${mensaje}`);
      }
    });
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
      topics: this.topics,
    };
  }
}
