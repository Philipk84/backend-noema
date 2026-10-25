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
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
@ApiForbiddenResponse({ description: 'Sin el permiso manage_roles' })
@Controller('roles')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Permissions('manage_roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un rol' })
  @ApiCreatedResponse({ description: 'Rol creado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiConflictResponse({ description: 'El nombre ya existe' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar los roles' })
  @ApiOkResponse({ description: 'Listado de roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un rol por id' })
  @ApiOkResponse({ description: 'Rol encontrado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un rol' })
  @ApiOkResponse({ description: 'Rol actualizado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  @ApiConflictResponse({ description: 'El nombre ya existe' })
  update(
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un rol' })
  @ApiNoContentResponse({ description: 'Rol eliminado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  async remove(@Param('id', PositiveIntPipe) id: number) {
    await this.rolesService.remove(id);
  }
}
