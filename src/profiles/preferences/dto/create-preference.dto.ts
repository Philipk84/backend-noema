import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePreferenceDto {
  @ApiProperty({
    description:
      'Lista completa de tags de preferencia. Reemplaza las anteriores y se normaliza a minúsculas sin espacios sobrantes',
    type: [String],
    example: ['nodejs', 'ciencia ficción', 'poesía'],
    maxItems: 30,
    uniqueItems: true,
  })
  @IsArray({ message: 'tags debe ser un arreglo' })
  @ArrayMaxSize(30, { message: 'No puedes tener más de 30 preferencias' })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'Cada tag admite máximo 50 caracteres',
  })
  tags: string[];
}
