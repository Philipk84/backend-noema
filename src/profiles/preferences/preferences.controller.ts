import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { PreferencesService } from './preferences.service';

@ApiTags('Preferences')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
@Controller('preferences')
@UseGuards(AuthGuard('jwt'))
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener las preferencias del usuario autenticado',
    description: 'Devuelve los tags de preferencia ordenados alfabéticamente.',
  })
  @ApiOkResponse({
    description: 'Tags de preferencia',
    type: [String],
    schema: { example: ['ciencia ficción', 'nodejs', 'poesía'] },
  })
  @ApiNotFoundResponse({ description: 'El usuario aún no tiene un perfil' })
  findMine(@CurrentUser() userObj: User) {
    return this.preferencesService.findMine(userObj.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Reemplazar las preferencias del usuario autenticado',
    description:
      'Sustituye todas las preferencias por la lista enviada. Los tags se normalizan a minúsculas y se eliminan duplicados.',
  })
  @ApiBody({ type: CreatePreferenceDto })
  @ApiOkResponse({
    description: 'Tags de preferencia resultantes',
    type: [String],
    schema: { example: ['ciencia ficción', 'nodejs', 'poesía'] },
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiNotFoundResponse({ description: 'El usuario aún no tiene un perfil' })
  replaceMine(
    @CurrentUser() userObj: User,
    @Body() createPreferenceDto: CreatePreferenceDto,
  ) {
    return this.preferencesService.replaceMine(userObj.id, createPreferenceDto);
  }
}
