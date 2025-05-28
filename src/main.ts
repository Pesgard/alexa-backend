import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Habilitar CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Validación global
  app.useGlobalPipes(new ValidationPipe());
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 Servidor NestJS ejecutándose en puerto ${port}`);
  logger.log(`📡 MQTT Service integrado para comunicación con ESP32`);
  logger.log(`🏠 Topics MQTT:`);
  logger.log(`   - casa/dispositivo/comando (Backend → ESP32)`);
  logger.log(`   - casa/dispositivo/estado (ESP32 → Backend)`);
  logger.log(`   - casa/dispositivo/heartbeat (ESP32 → Backend)`);
}
bootstrap();