import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionNotFoundException } from '../../common/exceptions';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    await this.assertNameAvailable(createPermissionDto.permissionName);
    const permissionObj = this.permissionRepository.create(createPermissionDto);
    return await this.permissionRepository.save(permissionObj);
  }

  async findAll(): Promise<Permission[]> {
    return await this.permissionRepository.find();
  }

  async findOne(id: number): Promise<Permission> {
    const permissionObj = await this.permissionRepository.findOneBy({ id });
    if (!permissionObj) {
      throw new PermissionNotFoundException(id);
    }
    return permissionObj;
  }

  async update(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permissionObj = await this.findOne(id);
    if (
      updatePermissionDto.permissionName &&
      updatePermissionDto.permissionName !== permissionObj.permissionName
    ) {
      await this.assertNameAvailable(updatePermissionDto.permissionName);
    }
    this.permissionRepository.merge(permissionObj, updatePermissionDto);
    return await this.permissionRepository.save(permissionObj);
  }

  async remove(id: number): Promise<{ message: string }> {
    const permissionObj = await this.findOne(id);
    await this.permissionRepository.remove(permissionObj);
    return { message: `Permission with id #${id} deleted successfully` };
  }

  private async assertNameAvailable(permissionName: string): Promise<void> {
    const existingPermissionObj = await this.permissionRepository.findOneBy({
      permissionName,
    });
    if (existingPermissionObj) {
      throw new ConflictException(
        `Ya existe un permiso con el nombre '${permissionName}'`,
      );
    }
  }
}
