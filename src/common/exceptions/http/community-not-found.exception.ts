import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando una comunidad no existe o no está disponible.
 */
export class CommunityNotFoundException extends NotFoundException {
  constructor(communityId: number, internalCode?: string) {
    super({
      error: 'Community Not Found',
      message: `La comunidad con identificador ${communityId} no fue encontrada.`,
      code: internalCode,
    });
  }
}
