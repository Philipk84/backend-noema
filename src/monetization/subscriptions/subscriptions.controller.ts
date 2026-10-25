import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiPaymentRequiredResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import {
  CreateSubscriptionDto,
  RenewSubscriptionDto,
} from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Suscripciones')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(AuthGuard('jwt'))
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Suscribirse a un plan y cobrar el primer periodo' })
  @ApiPaymentRequiredResponse({ description: 'Pago rechazado por la pasarela' })
  @ApiForbiddenResponse({ description: 'Estás vetado de la comunidad' })
  @ApiNotFoundResponse({ description: 'Plan no encontrado' })
  @ApiConflictResponse({ description: 'Ya tienes una suscripción vigente' })
  @HttpCode(HttpStatus.CREATED)
  subscribe(
    @CurrentUser() userObj: User,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.subscribe(
      userObj.id,
      createSubscriptionDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis suscripciones' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.subscriptionsService.findMine(userObj.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una suscripción propia' })
  @ApiForbiddenResponse({ description: 'La suscripción es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  findOne(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.subscriptionsService.findOne(userObj.id, id);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renovar la suscripción cobrando otro periodo' })
  @ApiPaymentRequiredResponse({ description: 'Pago rechazado por la pasarela' })
  @ApiForbiddenResponse({ description: 'La suscripción es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  @HttpCode(HttpStatus.OK)
  renew(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() renewSubscriptionDto: RenewSubscriptionDto,
  ) {
    return this.subscriptionsService.renew(
      userObj.id,
      id,
      renewSubscriptionDto,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      'Cancelar la renovación (el acceso sigue hasta el fin del periodo)',
  })
  @ApiForbiddenResponse({ description: 'La suscripción es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.subscriptionsService.cancel(userObj.id, id);
  }
}
