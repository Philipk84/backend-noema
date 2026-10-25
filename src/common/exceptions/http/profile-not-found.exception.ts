import { NotFoundException } from '@nestjs/common';

export class ProfileNotFoundException extends NotFoundException {
  constructor(profileId: number, internalCode?: string) {
    super({
      error: 'Profile Not Found',
      message: `El perfil con identificador ${profileId} no fue encontrado.`,
      code: internalCode,
    });
  }
}