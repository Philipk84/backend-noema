import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentMethod } from '../../enums/monetization.enums';

export interface ChargeRequest {
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Token del medio de pago, como lo entregaría el SDK de la pasarela real. */
  token?: string;
}

export interface ChargeResult {
  approved: boolean;
  /** Referencia de la operación en la pasarela; se guarda en Payment.externalReference. */
  reference: string;
  reason?: string;
}

/**
 * Contrato con la pasarela de pagos. Una pasarela real (Stripe, PayPal, etc.)
 * se integra implementando esta clase y cambiando el provider del módulo.
 */
export abstract class PaymentGateway {
  abstract charge(request: ChargeRequest): Promise<ChargeResult>;
}

/** Token que la pasarela simulada rechaza, como los tokens de prueba de las pasarelas reales. */
export const DECLINED_TEST_TOKEN = 'tok_declined';

/** Pasarela de desarrollo: aprueba todo, salvo el token de prueba rechazado. */
@Injectable()
export class SimulatedPaymentGateway extends PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult> {
    const reference = `SIM-${randomUUID()}`;
    if (request.token === DECLINED_TEST_TOKEN) {
      return Promise.resolve({
        approved: false,
        reference,
        reason: 'Pago rechazado por el emisor (pasarela simulada)',
      });
    }
    return Promise.resolve({ approved: true, reference });
  }
}
