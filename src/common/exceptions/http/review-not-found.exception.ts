import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando la reseña no existe o no está disponible.
 */
export class ReviewNotFoundException extends NotFoundException {
  constructor(reviewId: number, internalCode?: string) {
    super({
      error: 'Review Not Found',
      message: `La reseña con identificador ${reviewId} no fue encontrada.`,
      code: internalCode,
    });
  }
}
