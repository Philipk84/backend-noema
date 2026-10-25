import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleNotFoundException } from '../../common/exceptions';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const { permissionIds, ...roleData } = createRoleDto;
    await this.assertNameAvailable(roleData.roleName);

    const roleObj = await this.roleRepository.save(
      this.roleRepository.create(roleData),
    );

    if (permissionIds?.length) {
      await this.replacePermissions(roleObj.id, permissionIds);
    }
    return await this.findOne(roleObj.id);
  }

  async findAll(): Promise<Role[]> {
    return await this.roleRepository.find({
      relations: { rolePermissions: { permission: true } },
    });
  }

  async findOne(id: number): Promise<Role> {
    const roleObj = await this.roleRepository.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });
    if (!roleObj) {
      throw new RoleNotFoundException(id);
    }
    return roleObj;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const roleObj = await this.findOne(id);
    const { permissionIds, ...roleData } = updateRoleDto;

    if (roleData.roleName && roleData.roleName !== roleObj.roleName) {
      await this.assertNameAvailable(roleData.roleName);
    }

    this.roleRepository.merge(roleObj, roleData);
    await this.roleRepository.save(roleObj);

    if (permissionIds !== undefined) {
      await this.replacePermissions(id, permissionIds);
    }
    return await this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    const roleObj = await this.findOne(id);
    await this.roleRepository.remove(roleObj);
    return { message: `Role with id #${id} deleted successfully` };
  }

  /** Reemplaza todos los permisos del rol por los indicados. */
  private async replacePermissions(
    roleId: number,
    permissionIds: number[],
  ): Promise<void> {
    // findOne lanza PermissionNotFoundException si algún id no existe
    for (const permissionId of permissionIds) {
      await this.permissionsService.findOne(permissionId);
    }

    await this.rolePermissionRepository.delete({ roleId });
    const rolePermissionObjs = permissionIds.map((permissionId) =>
      this.rolePermissionRepository.create({ roleId, permissionId }),
    );
    await this.rolePermissionRepository.save(rolePermissionObjs);
  }

  private async assertNameAvailable(roleName: string): Promise<void> {
    const existingRoleObj = await this.roleRepository.findOneBy({ roleName });
    if (existingRoleObj) {
      throw new ConflictException(
        `Ya existe un rol con el nombre '${roleName}'`,
      );
    }
  }
}
