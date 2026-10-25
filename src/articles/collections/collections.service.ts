import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionNotFoundException } from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/create-collection.dto';
import { Collection } from './entities/collection.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(
    userId: number,
    createCollectionDto: CreateCollectionDto,
  ): Promise<Collection> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const collectionObj = this.collectionRepository.create({
      ...createCollectionDto,
      authorId: profileObj.id,
    });
    return await this.collectionRepository.save(collectionObj);
  }

  async findAll(authorId?: number): Promise<Collection[]> {
    return await this.collectionRepository.find({
      where: authorId ? { authorId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Collection> {
    const collectionObj = await this.collectionRepository.findOneBy({ id });
    if (!collectionObj) {
      throw new CollectionNotFoundException(id);
    }
    return collectionObj;
  }

  /** Colección que pertenece al perfil del usuario autenticado. */
  async findOwned(userId: number, id: number): Promise<Collection> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const collectionObj = await this.findOne(id);
    if (collectionObj.authorId !== profileObj.id) {
      throw new ForbiddenException('Esta colección pertenece a otro autor');
    }
    return collectionObj;
  }

  async update(
    userId: number,
    id: number,
    updateCollectionDto: UpdateCollectionDto,
  ): Promise<Collection> {
    const collectionObj = await this.findOwned(userId, id);
    this.collectionRepository.merge(collectionObj, updateCollectionDto);
    return await this.collectionRepository.save(collectionObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const collectionObj = await this.findOwned(userId, id);
    await this.collectionRepository.remove(collectionObj);
    return { message: `Collection with id #${id} deleted successfully` };
  }
}
