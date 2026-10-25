import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserNotFoundException } from '../../common/exceptions';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { roleIds, password, ...userData } = createUserDto;
    await this.assertEmailAvailable(userData.email);
    await this.assertRolesExist(roleIds);

    const userObj = await this.userRepository.save(
      this.userRepository.create({
        ...userData,
        password: await this.hashPassword(password),
      }),
    );
    await this.replaceRoles(userObj.id, roleIds);

    return await this.findOne(userObj.id);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      relations: { userRoles: { role: true } },
    });
  }

  async findOne(id: number, withPermissions: boolean = false): Promise<User> {
    const userObj = await this.userRepository.findOne({
      where: { id },
      relations: {
        userRoles: {
          role: withPermissions
            ? { rolePermissions: { permission: true } }
            : true,
        },
      },
    });
    if (!userObj) {
      throw new UserNotFoundException(id);
    }
    return userObj;
  }

  /** Incluye el hash de la contraseña y los permisos; solo para autenticación. */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
      },
      relations: {
        userRoles: { role: { rolePermissions: { permission: true } } },
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const userObj = await this.findOne(id);
    const { roleIds, password, ...userData } = updateUserDto;

    if (userData.email && userData.email !== userObj.email) {
      await this.assertEmailAvailable(userData.email);
    }
    if (roleIds !== undefined) {
      await this.assertRolesExist(roleIds);
    }

    const changes: Partial<User> = { ...userData };
    if (password) {
      changes.password = await this.hashPassword(password);
    }
    if (Object.keys(changes).length > 0) {
      await this.userRepository.update(id, changes);
    }
    if (roleIds !== undefined) {
      await this.replaceRoles(id, roleIds);
    }

    return await this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    const userObj = await this.findOne(id);
    await this.userRepository.remove(userObj);
    return { message: `User with id #${id} deleted successfully` };
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(
      this.configService.get<string>('SALT_ROUNDS') ?? '10',
      10,
    );
    return await bcrypt.hash(password, saltRounds);
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existingUserObj = await this.userRepository.findOneBy({ email });
    if (existingUserObj) {
      throw new ConflictException(`El correo '${email}' ya está registrado`);
    }
  }

  /** findOne lanza RoleNotFoundException si algún id no existe. */
  private async assertRolesExist(roleIds: number[]): Promise<void> {
    for (const roleId of roleIds) {
      await this.rolesService.findOne(roleId);
    }
  }

  /** Reemplaza todos los roles del usuario por los indicados. */
  private async replaceRoles(userId: number, roleIds: number[]): Promise<void> {
    await this.userRoleRepository.delete({ userId });
    const userRoleObjs = roleIds.map((roleId) =>
      this.userRoleRepository.create({ userId, roleId }),
    );
    await this.userRoleRepository.save(userRoleObjs);
  }
}
