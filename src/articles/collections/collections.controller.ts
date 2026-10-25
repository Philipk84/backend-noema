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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { CollectionsService } from './collections.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/create-collection.dto';

class FindCollectionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number;
}

@ApiTags('Colecciones')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una colección de artículos' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(userObj.id, createCollectionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar colecciones, con filtro por autor' })
  findAll(@Query() query: FindCollectionsQueryDto) {
    return this.collectionsService.findAll(query.authorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una colección' })
  @ApiNotFoundResponse({ description: 'Colección no encontrada' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.collectionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una colección propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La colección es de otro autor' })
  @ApiNotFoundResponse({ description: 'Colección no encontrada' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(userObj.id, id, updateCollectionDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Eliminar una colección propia (sus artículos quedan sin colección)',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La colección es de otro autor' })
  @ApiNotFoundResponse({ description: 'Colección no encontrada' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.collectionsService.remove(userObj.id, id);
  }
}
