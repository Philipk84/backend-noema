import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando la publicación no existe o no está disponible.
 */
export class PostNotFoundException extends NotFoundException {
  constructor(postId: number, internalCode?: string) {
    super({
      error: 'Post Not Found',
      message: `La publicación con identificador ${postId} no fue encontrada.`,
      code: internalCode,
    });
  }
}