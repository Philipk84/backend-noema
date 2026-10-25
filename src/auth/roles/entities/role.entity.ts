import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../users/entities/user-role.entity';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_name', unique: true, length: 50 })
  roleName: string;

  @OneToMany(
    () => RolePermission,
    (rolePermissionObj) => rolePermissionObj.role,
  )
  rolePermissions: RolePermission[];

  @OneToMany(() => UserRole, (userRoleObj) => userRoleObj.role)
  userRoles: UserRole[];
}
