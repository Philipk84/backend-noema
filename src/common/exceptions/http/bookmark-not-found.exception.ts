import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando el marcador no existe o no está disponible.
 */
export class BookmarkNotFoundException extends NotFoundException {
  constructor(bookmarkId: number, internalCode?: string) {
    super({
      error: 'Bookmark Not Found',
      message: `El marcador con identificador ${bookmarkId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
