import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Excepción lanzada cuando la pasarela rechaza un cobro (HTTP 402).
 */
export class PaymentDeclinedException extends HttpException {
  constructor(reason: string, internalCode?: string) {
    super(
      {
        error: 'Payment Declined',
        message: reason,
        code: internalCode,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
