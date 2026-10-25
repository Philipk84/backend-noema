import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { ReadingListNotFoundException } from '../../common/exceptions/http/reading-list-not-found.exception';
import { ProfilesService } from '../../profiles/profiles.service';
import { ReadingListVisibility } from '../enums/reading-list-status.enum';
import {
  CreateReadingListDto,
  UpdateReadingListDto,
} from './dto/create-reading-list.dto';
import { ReadingListItem } from './entities/reading-list-item.entity';
import { ReadingList } from './entities/reading-list.entity';

@Injectable()
export class ReadingListsService {
  constructor(
    @InjectRepository(ReadingList)
    private readonly readingListRepository: Repository<ReadingList>,
    @InjectRepository(ReadingListItem)
    private readonly readingListItemRepository: Repository<ReadingListItem>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
  ) {}

  async create(
    userId: number,
    createReadingListDto: CreateReadingListDto,
  ): Promise<ReadingList> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const readingListObj = this.readingListRepository.create({
      ...createReadingListDto,
      profileId: profileObj.id,
    });
    return await this.readingListRepository.save(readingListObj);
  }

  async findMine(userId: number): Promise<ReadingList[]> {
    const profileObj = await this.profilesService.findByUserId(userId);
    return await this.readingListRepository.find({
      where: { profileId: profileObj.id },
      order: { createdAt: 'DESC' },
    });
  }

  /** Listas públicas de un perfil. */
  async findPublicByProfile(profileId: number): Promise<ReadingList[]> {
    await this.profilesService.findOne(profileId);
    return await this.readingListRepository.find({
      where: { profileId, visibility: ReadingListVisibility.PUBLIC },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Detalle de una lista con sus artículos en orden. Una lista privada solo la
   * ve su dueño; para el resto se comporta como inexistente.
   */
  async findOneVisible(
    id: number,
    userId: number | null,
  ): Promise<ReadingList> {
    const readingListObj = await this.readingListRepository.findOne({
      where: { id },
      relations: { items: { article: true } },
      order: { items: { orderIndex: 'ASC' } },
    });
    if (!readingListObj) {
      throw new ReadingListNotFoundException(id);
    }

    if (readingListObj.visibility === ReadingListVisibility.PRIVATE) {
      const profileObj =
        userId === null
          ? null
          : await this.profilesService.findByUserIdOrNull(userId);
      if (!profileObj || profileObj.id !== readingListObj.profileId) {
        throw new ReadingListNotFoundException(id);
      }
    }
    return readingListObj;
  }

  async update(
    userId: number,
    id: number,
    updateReadingListDto: UpdateReadingListDto,
  ): Promise<ReadingList> {
    const readingListObj = await this.findOwned(userId, id);
    this.readingListRepository.merge(readingListObj, updateReadingListDto);
    return await this.readingListRepository.save(readingListObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const readingListObj = await this.findOwned(userId, id);
    await this.readingListRepository.remove(readingListObj);
    return { message: `Reading list with id #${id} deleted successfully` };
  }

  /** Agrega el artículo al final de la lista. */
  async addItem(
    userId: number,
    id: number,
    articleId: number,
  ): Promise<ReadingListItem> {
    const readingListObj = await this.findOwned(userId, id);
    const articleObj = await this.articlesService.findPublishedOne(articleId, userId);

    const existingItemObj = await this.readingListItemRepository.findOneBy({
      readingListId: readingListObj.id,
      articleId: articleObj.id,
    });
    if (existingItemObj) {
      throw new ConflictException('El artículo ya está en la lista');
    }

    const lastOrderIndex = await this.readingListItemRepository.maximum(
      'orderIndex',
      { readingListId: readingListObj.id },
    );
    const readingListItemObj = this.readingListItemRepository.create({
      readingListId: readingListObj.id,
      articleId: articleObj.id,
      orderIndex: (lastOrderIndex ?? -1) + 1,
    });
    return await this.readingListItemRepository.save(readingListItemObj);
  }

  /**
   * Reordena la lista: articleIds debe contener exactamente los artículos
   * actuales, en el orden deseado. Las posiciones quedan como 0, 1, 2…
   */
  async reorderItems(
    userId: number,
    id: number,
    articleIds: number[],
  ): Promise<ReadingListItem[]> {
    const readingListObj = await this.findOwned(userId, id);
    const readingListItemObjs = await this.readingListItemRepository.find({
      where: { readingListId: readingListObj.id },
    });

    const currentArticleIds = new Set(
      readingListItemObjs.map((itemObj) => itemObj.articleId),
    );
    // Misma cantidad, sin repetidos y todos pertenecientes a la lista
    const isSameSet =
      articleIds.length === currentArticleIds.size &&
      new Set(articleIds).size === articleIds.length &&
      articleIds.every((articleId) => currentArticleIds.has(articleId));
    if (!isSameSet) {
      throw new BadRequestException(
        'articleIds debe contener exactamente los artículos de la lista, sin repetir',
      );
    }

    const positionByArticleId = new Map(
      articleIds.map((articleId, position) => [articleId, position]),
    );
    for (const readingListItemObj of readingListItemObjs) {
      readingListItemObj.orderIndex = positionByArticleId.get(
        readingListItemObj.articleId,
      )!;
    }
    // Guardar un arreglo se ejecuta en una sola transacción
    await this.readingListItemRepository.save(readingListItemObjs);
    return readingListItemObjs.sort(
      (itemA, itemB) => itemA.orderIndex - itemB.orderIndex,
    );
  }

  async removeItem(
    userId: number,
    id: number,
    articleId: number,
  ): Promise<{ message: string }> {
    const readingListObj = await this.findOwned(userId, id);
    const readingListItemObj = await this.readingListItemRepository.findOneBy({
      readingListId: readingListObj.id,
      articleId,
    });
    if (!readingListItemObj) {
      throw new NotFoundException('El artículo no está en la lista');
    }
    await this.readingListItemRepository.remove(readingListItemObj);
    return { message: `Article #${articleId} removed from the list` };
  }

  private async findOwned(userId: number, id: number): Promise<ReadingList> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const readingListObj = await this.readingListRepository.findOneBy({ id });
    if (!readingListObj) {
      throw new ReadingListNotFoundException(id);
    }
    if (readingListObj.profileId !== profileObj.id) {
      // Una lista privada ajena no debe revelar su existencia
      if (readingListObj.visibility === ReadingListVisibility.PRIVATE) {
        throw new ReadingListNotFoundException(id);
      }
      throw new ForbiddenException('Esta lista pertenece a otro perfil');
    }
    return readingListObj;
  }
}
