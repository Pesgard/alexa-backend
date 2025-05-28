import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class DispositivoDto {
    @IsString()
    dispositivo: string;
  
    @IsString()
    @IsIn(['on', 'off'])
    estado: string;
  
    @IsString()
    @IsOptional()
    timestamp?: string;
}

export class EstadoDispositivoDto {
    @IsString()
    @IsIn(['on', 'off'])
    estado: string;

    @IsString()
    @IsOptional()
    timestamp?: string;

    @IsNumber()
    @IsOptional()
    esp32sConectados: number;
}