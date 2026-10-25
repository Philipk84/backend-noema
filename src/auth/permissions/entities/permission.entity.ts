import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolePermission } from '../../roles/entities/role-permission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'permission_name', unique: true, length: 50 })
  permissionName: string;

  @OneToMany(
    () => RolePermission,
    (rolePermissionObj) => rolePermissionObj.permission,
  )
  rolePermissions: RolePermission[];
}
