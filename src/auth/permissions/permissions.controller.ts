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
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
@ApiForbiddenResponse({ description: 'Sin el permiso manage_roles' })
@Controller('permissions')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Permissions('manage_roles')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un permiso' })
  @ApiCreatedResponse({ description: 'Permiso creado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiConflictResponse({ description: 'El nombre ya existe' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar los permisos' })
  @ApiOkResponse({ description: 'Listado de permisos' })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un permiso por id' })
  @ApiOkResponse({ description: 'Permiso encontrado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Permiso no encontrado' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  @ApiOkResponse({ description: 'Permiso actualizado' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiNotFoundResponse({ description: 'Permiso no encontrado' })
  @ApiConflictResponse({ description: 'El nombre ya existe' })
  update(
    @Param('id', PositiveIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un permiso' })
  @ApiNoContentResponse({ description: 'Permiso eliminado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Permiso no encontrado' })
  async remove(@Param('id', PositiveIntPipe) id: number) {
    await this.permissionsService.remove(id);
  }
}
