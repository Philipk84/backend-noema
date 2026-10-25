import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando el comentario no existe o no está disponible.
 */
export class CommentNotFoundException extends NotFoundException {
  constructor(commentId: number, internalCode?: string) {
    super({
      error: 'Comment Not Found',
      message: `El comentario con identificador ${commentId} no fue encontrado.`,
      code: internalCode,
    });
  }
}