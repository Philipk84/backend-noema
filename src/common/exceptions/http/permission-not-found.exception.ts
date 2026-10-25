import { NotFoundException } from '@nestjs/common';

/**
 * Excepción lanzada cuando un permiso no existe en la base de datos.
 */
export class PermissionNotFoundException extends NotFoundException {
  constructor(permissionId: number, internalCode?: string) {
    super({
      error: 'Permission Not Found',
      message: `El permiso con identificador ${permissionId} no fue encontrado.`,
      code: internalCode,
    });
  }
}
