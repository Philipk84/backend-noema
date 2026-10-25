import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando la lista de lectura no existe o no está disponible.
 */
export class ReadingListNotFoundException extends NotFoundException {
  constructor(readingListId: number, internalCode?: string) {
    super({
      error: 'ReadingList Not Found',
      message: `La lista de lectura con identificador ${readingListId} no fue encontrada.`,
      code: internalCode,
    });
  }
}
