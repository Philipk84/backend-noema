import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando el plan no existe o no está disponible.
 */
export class PlanNotFoundException extends NotFoundException {
  constructor(planId: number, internalCode?: string) {
    super({
      error: 'Plan Not Found',
      message: `El plan con identificador ${planId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
