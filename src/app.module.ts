import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DispositivoModule } from './dispositivo/dispositivo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DispositivoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
