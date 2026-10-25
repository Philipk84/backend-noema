import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(150, { message: 'El título no puede exceder 150 caracteres' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}
