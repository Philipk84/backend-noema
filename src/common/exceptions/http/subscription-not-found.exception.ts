import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando la suscripción no existe o no está disponible.
 */
export class SubscriptionNotFoundException extends NotFoundException {
  constructor(subscriptionId: number, internalCode?: string) {
    super({
      error: 'Subscription Not Found',
      message: `La suscripción con identificador ${subscriptionId} no fue encontrada.`,
      code: internalCode,
    });
  }
}
