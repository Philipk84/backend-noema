import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { ReactionTargetType } from '../enums/reaction.enums';
import { SetReactionDto } from './dto/set-reaction.dto';
import { ReactionsService } from './reactions.service';

// targetType: article | post | comment
@ApiTags('Reacciones')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Get(':targetType/:targetId')
  @ApiOperation({
    summary: 'Resumen de reacciones de un artículo, post o comentario',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Recurso no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  summary(
    @CurrentUser() userObj: User | null,
    @Param('targetType', new ParseEnumPipe(ReactionTargetType))
    targetType: ReactionTargetType,
    @Param('targetId', PositiveIntPipe) targetId: number,
  ) {
    return this.reactionsService.summary(
      targetType,
      targetId,
      userObj?.id ?? null,
    );
  }

  @Put(':targetType/:targetId')
  @ApiOperation({
    summary: 'Reaccionar a un recurso, o cambiar el tipo de reacción',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Recurso no disponible' })
  @UseGuards(AuthGuard('jwt'))
  set(
    @CurrentUser() userObj: User,
    @Param('targetType', new ParseEnumPipe(ReactionTargetType))
    targetType: ReactionTargetType,
    @Param('targetId', PositiveIntPipe) targetId: number,
    @Body() setReactionDto: SetReactionDto,
  ) {
    return this.reactionsService.set(
      userObj.id,
      targetType,
      targetId,
      setReactionDto.type,
    );
  }

  @Delete(':targetType/:targetId')
  @ApiOperation({ summary: 'Quitar mi reacción a un recurso' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'No habías reaccionado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('targetType', new ParseEnumPipe(ReactionTargetType))
    targetType: ReactionTargetType,
    @Param('targetId', PositiveIntPipe) targetId: number,
  ) {
    await this.reactionsService.remove(userObj.id, targetType, targetId);
  }
}