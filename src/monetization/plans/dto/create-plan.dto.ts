import { PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { BillingPeriod } from '../../enums/monetization.enums';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio admite máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El precio mínimo es 0.01' })
  price: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO4217CurrencyCode({
    message: 'La moneda debe ser un código ISO 4217 (USD, EUR, COP…)',
  })
  currency: string;

  @IsEnum(BillingPeriod, {
    message: 'El periodo debe ser MONTHLY o YEARLY',
  })
  billingPeriod: BillingPeriod;

  // Si se indica, es un plan de esa comunidad (hay que ser su propietario); si no, un plan del autor
  @IsOptional()
  @IsInt({ message: 'communityId debe ser un entero' })
  communityId?: number;
}

// Moneda, periodo y titular no cambian: afectarían a quienes ya pagaron
export class UpdatePlanDto extends PartialType(
  PickType(CreatePlanDto, ['name', 'price'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FindPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  communityId?: number;
}
