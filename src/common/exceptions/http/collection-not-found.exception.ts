import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando la colección no existe o no está disponible.
 */
export class CollectionNotFoundException extends NotFoundException {
  constructor(collectionId: number, internalCode?: string) {
    super({
      error: 'Collection Not Found',
      message: `La colección con identificador ${collectionId} no fue encontrada.`,
      code: internalCode,
    });
  }
}
