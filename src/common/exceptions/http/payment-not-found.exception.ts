import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando el pago no existe o no está disponible.
 */
export class PaymentNotFoundException extends NotFoundException {
  constructor(paymentId: number, internalCode?: string) {
    super({
      error: 'Payment Not Found',
      message: `El pago con identificador ${paymentId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
