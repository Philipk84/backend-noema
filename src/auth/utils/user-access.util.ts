import { User } from '../users/entities/user.entity';

/** Nombres de los roles del usuario (requiere userRoles.role cargado). */
export function extractRoleNames(userObj: User): string[] {
  return (
    userObj.userRoles?.map((userRoleObj) => userRoleObj.role.roleName) ?? []
  );
}

/** Nombres únicos de los permisos de todos los roles del usuario. */
export function extractPermissionNames(userObj: User): string[] {
  const permissionNames =
    userObj.userRoles?.flatMap(
      (userRoleObj) =>
        userRoleObj.role.rolePermissions?.map(
          (rolePermissionObj) => rolePermissionObj.permission.permissionName,
        ) ?? [],
    ) ?? [];
  return [...new Set(permissionNames)];
}
