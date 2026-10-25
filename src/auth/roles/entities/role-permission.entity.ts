import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from './role.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id' })
  roleId: number;

  @PrimaryColumn({ name: 'permission_id' })
  permissionId: number;

  @ManyToOne(() => Role, (roleObj) => roleObj.rolePermissions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(
    () => Permission,
    (permissionObj) => permissionObj.rolePermissions,
    { onDelete: 'CASCADE', nullable: false },
  )
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
