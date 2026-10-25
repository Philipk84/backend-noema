import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando un rol no existe en la base de datos.
 */
export class RoleNotFoundException extends NotFoundException {
  constructor(roleId: number, internalCode?: string) {
    super({
      error: 'Role Not Found',
      message: `El rol con identificador ${roleId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
