import {
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
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { FindPaymentsQueryDto } from './dto/find-payments-query.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Historial de mis pagos, con filtro por suscripción',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  findMine(@CurrentUser() userObj: User, @Query() query: FindPaymentsQueryDto) {
    return this.paymentsService.findMine(userObj.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver un pago propio' })
  @ApiForbiddenResponse({ description: 'El pago es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Pago no encontrado' })
  findOne(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.paymentsService.findOne(userObj.id, id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Reembolsar un pago (solo administración)' })
  @ApiForbiddenResponse({ description: 'Falta el permiso manage_payments' })
  @ApiNotFoundResponse({ description: 'Pago no encontrado' })
  @ApiConflictResponse({ description: 'El pago no está en estado PAID' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('manage_payments')
  refund(@Param('id', PositiveIntPipe) id: number) {
    return this.paymentsService.refund(id);
  }
}
