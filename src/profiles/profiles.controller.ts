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
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear el perfil del usuario autenticado',
    description:
      'Cada usuario puede tener un único perfil y el username debe ser único.',
  })
  @ApiBody({ type: CreateProfileDto })
  @ApiCreatedResponse({ description: 'Perfil creado', type: Profile })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiConflictResponse({
    description: 'El usuario ya tiene un perfil o el username ya está en uso',
  })
  create(
    @CurrentUser() userObj: User,
    @Body() createProfileDto: CreateProfileDto,
  ) {
    return this.profilesService.create(userObj.id, createProfileDto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  @ApiOkResponse({ description: 'Perfil del usuario', type: Profile })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiNotFoundResponse({ description: 'El usuario aún no tiene un perfil' })
  findMine(@CurrentUser() userObj: User) {
    return this.profilesService.findByUserId(userObj.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar el perfil del usuario autenticado',
    description:
      'Todos los campos son opcionales; solo se modifican los enviados.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Perfil actualizado', type: Profile })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiNotFoundResponse({ description: 'El usuario aún no tiene un perfil' })
  @ApiConflictResponse({ description: 'El username ya está en uso' })
  update(
    @CurrentUser() userObj: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profilesService.update(userObj.id, updateProfileDto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar el perfil del usuario autenticado' })
  @ApiNoContentResponse({ description: 'Perfil eliminado' })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiNotFoundResponse({ description: 'El usuario aún no tiene un perfil' })
  async remove(@CurrentUser() userObj: User) {
    await this.profilesService.remove(userObj.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los perfiles' })
  @ApiOkResponse({ description: 'Listado de perfiles', type: [Profile] })
  findAll() {
    return this.profilesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un perfil por su identificador' })
  @ApiParam({
    name: 'id',
    description: 'Identificador del perfil',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({ description: 'Perfil encontrado', type: Profile })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Perfil no encontrado' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.profilesService.findOne(id);
  }
}
