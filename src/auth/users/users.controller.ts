import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Registro público
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un usuario' })
  @ApiCreatedResponse({ description: 'Usuario creado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('manage_users')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Sin el permiso manage_users' })
  @ApiOperation({ summary: 'Listar los usuarios' })
  @ApiOkResponse({ description: 'Listado de usuarios' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('manage_users')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Sin el permiso manage_users' })
  @ApiOperation({ summary: 'Obtener un usuario por id' })
  @ApiOkResponse({ description: 'Usuario encontrado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('manage_users')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Sin el permiso manage_users' })
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiOkResponse({ description: 'Usuario actualizado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  update(
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('manage_users')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Sin el permiso manage_users' })
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @ApiNoContentResponse({ description: 'Usuario eliminado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  async remove(@Param('id', PositiveIntPipe) id: number) {
    await this.usersService.remove(id);
  }
}
