import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../enums/monetization.enums';

export class RenewSubscriptionDto {
  @IsEnum(PaymentMethod, {
    message: 'El medio de pago debe ser CARD, PAYPAL o BANK_TRANSFER',
  })
  paymentMethod: PaymentMethod;

  // Token del medio de pago. La pasarela simulada rechaza 'tok_declined'
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentToken?: string;
}

export class CreateSubscriptionDto extends RenewSubscriptionDto {
  @IsInt({ message: 'planId debe ser un entero' })
  planId: number;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
