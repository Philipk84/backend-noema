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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import {
  CreatePlanDto,
  FindPlansQueryDto,
  UpdatePlanDto,
} from './dto/create-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('Planes')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un plan de autor o de comunidad' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'No eres propietario de la comunidad' })
  @ApiNotFoundResponse({ description: 'Comunidad o perfil no encontrado' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(@CurrentUser() userObj: User, @Body() createPlanDto: CreatePlanDto) {
    return this.plansService.create(userObj.id, createPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Catálogo público de planes activos' })
  findAll(@Query() query: FindPlansQueryDto) {
    return this.plansService.findAll(query);
  }

  // Declarado antes que ':id' para que "mine" no se interprete como un id
  @Get('mine')
  @ApiOperation({ summary: 'Listar los planes que administro' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @UseGuards(AuthGuard('jwt'))
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.plansService.findMine(userObj.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver un plan' })
  @ApiNotFoundResponse({ description: 'Plan no encontrado' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar nombre, precio o activación de un plan propio',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El plan es de otro titular' })
  @ApiNotFoundResponse({ description: 'Plan no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updatePlanDto: UpdatePlanDto,
  ) {
    return this.plansService.update(userObj.id, id, updatePlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar un plan sin suscripciones' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El plan es de otro titular' })
  @ApiNotFoundResponse({ description: 'Plan no encontrado' })
  @ApiConflictResponse({ description: 'Tiene suscripciones: desactívalo' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.plansService.remove(userObj.id, id);
  }
}
