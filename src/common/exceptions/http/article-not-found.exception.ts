import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando el artículo no existe o no está disponible.
 */
export class ArticleNotFoundException extends NotFoundException {
  constructor(articleId: number, internalCode?: string) {
    super({
      error: 'Article Not Found',
      message: `El artículo con identificador ${articleId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
