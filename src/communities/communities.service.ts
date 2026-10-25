import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
import {
  Paginated,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { CommunityNotFoundException } from '../common/exceptions';
import { ProfilesService } from '../profiles/profiles.service';
import {
  CreateCommunityDto,
  FindCommunitiesQueryDto,
  UpdateCommunityDto,
} from './dto/create-community.dto';
import { CommunityTag } from './entities/community-tag.entity';
import { Community } from './entities/community.entity';
import { MembershipRole, MembershipStatus } from './enums/membership.enums';
import { Membership } from './memberships/entities/membership.entity';

export type CommunityDetail = Community & { memberCount: number };

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityTag)
    private readonly communityTagRepository: Repository<CommunityTag>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly profilesService: ProfilesService,
    private readonly dataSource: DataSource,
  ) {}

  /** Crea la comunidad; su creador queda como OWNER con membresía activa. */
  async create(
    userId: number,
    createCommunityDto: CreateCommunityDto,
  ): Promise<CommunityDetail> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const { tags, ...communityData } = createCommunityDto;
    await this.assertNameAvailable(communityData.name);

    const communityObj = await this.dataSource.transaction(async (manager) => {
      const savedCommunityObj = await manager.save(
        manager.create(Community, { ...communityData, ownerId: profileObj.id }),
      );
      await manager.save(
        manager.create(Membership, {
          profileId: profileObj.id,
          communityId: savedCommunityObj.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        }),
      );
      if (tags?.length) {
        await manager.save(
          this.normalizeTags(tags).map((tag) =>
            manager.create(CommunityTag, {
              communityId: savedCommunityObj.id,
              tag,
            }),
          ),
        );
      }
      return savedCommunityObj;
    });
    return await this.findOne(communityObj.id);
  }

  async findAll(query: FindCommunitiesQueryDto): Promise<Paginated<Community>> {
    const queryBuilder = this.communityRepository
      .createQueryBuilder('community')
      .leftJoinAndSelect('community.tags', 'communityTag');

    if (query.topic) {
      queryBuilder.andWhere('LOWER(community.topic) = :topic', {
        topic: query.topic.trim().toLowerCase(),
      });
    }
    if (query.search) {
      queryBuilder.andWhere('community.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.tag) {
      // Subconsulta para no recortar las etiquetas que se devuelven con la comunidad
      queryBuilder.andWhere(
        `EXISTS (SELECT 1 FROM community_tags filter_tag
                 WHERE filter_tag.community_id = community.id AND filter_tag.tag = :tag)`,
        { tag: query.tag.trim().toLowerCase() },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('community.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }

  /** Comunidades en las que el usuario es miembro activo. */
  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Membership>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.membershipRepository.findAndCount({
      where: { profileId: profileObj.id, status: MembershipStatus.ACTIVE },
      relations: { community: true },
      order: { joinedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number): Promise<CommunityDetail> {
    const communityObj = await this.communityRepository.findOne({
      where: { id },
      relations: { tags: true },
    });
    if (!communityObj) {
      throw new CommunityNotFoundException(id);
    }
    const memberCount = await this.membershipRepository.countBy({
      communityId: id,
      status: MembershipStatus.ACTIVE,
    });
    return Object.assign(communityObj, { memberCount });
  }

  /** Comunidad sin relaciones ni conteos; para validar que existe. */
  async findEntity(id: number): Promise<Community> {
    const communityObj = await this.communityRepository.findOneBy({ id });
    if (!communityObj) {
      throw new CommunityNotFoundException(id);
    }
    return communityObj;
  }

  async update(
    userId: number,
    id: number,
    updateCommunityDto: UpdateCommunityDto,
  ): Promise<CommunityDetail> {
    const communityObj = await this.findOwned(userId, id);
    if (
      updateCommunityDto.name &&
      updateCommunityDto.name !== communityObj.name
    ) {
      await this.assertNameAvailable(updateCommunityDto.name);
    }
    this.communityRepository.merge(communityObj, updateCommunityDto);
    await this.communityRepository.save(communityObj);
    return await this.findOne(id);
  }

  async replaceTags(
    userId: number,
    id: number,
    tags: string[],
  ): Promise<string[]> {
    const communityObj = await this.findOwned(userId, id);
    const normalizedTags = this.normalizeTags(tags);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CommunityTag, { communityId: communityObj.id });
      await manager.save(
        normalizedTags.map((tag) =>
          manager.create(CommunityTag, { communityId: communityObj.id, tag }),
        ),
      );
    });
    return normalizedTags.sort();
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const communityObj = await this.findOwned(userId, id);

    // Los artículos exclusivos no se reasignan solos: al quedar sin comunidad se harían públicos
    const exclusiveArticles = await this.articleRepository.countBy({
      communityId: communityObj.id,
    });
    if (exclusiveArticles > 0) {
      throw new ConflictException(
        `La comunidad tiene ${exclusiveArticles} artículo(s) exclusivo(s); muévelos o elimínalos antes de borrarla`,
      );
    }

    await this.communityRepository.remove(communityObj);
    return { message: `Community with id #${id} deleted successfully` };
  }

  /** Comunidad cuyo propietario es el perfil del usuario autenticado. */
  private async findOwned(userId: number, id: number): Promise<Community> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const communityObj = await this.findEntity(id);
    if (communityObj.ownerId !== profileObj.id) {
      throw new ForbiddenException(
        'Solo el propietario puede modificar la comunidad',
      );
    }
    return communityObj;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existingCommunityObj = await this.communityRepository.findOneBy({
      name,
    });
    if (existingCommunityObj) {
      throw new ConflictException(`Ya existe una comunidad llamada '${name}'`);
    }
  }

  /** Minúsculas, sin espacios sobrantes ni duplicados. */
  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim().toLowerCase()))].filter(
      (tag) => tag.length > 0,
    );
  }
}
