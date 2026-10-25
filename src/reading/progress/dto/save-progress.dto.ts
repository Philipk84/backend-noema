import { IsNumber, Max, Min } from 'class-validator';

export class SaveProgressDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El porcentaje admite máximo 2 decimales' },
  )
  @Min(0, { message: 'El porcentaje mínimo es 0' })
  @Max(100, { message: 'El porcentaje máximo es 100' })
  percentage: number;
}