import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotificationEvents,
  ProfileFollowedEvent,
} from '../../notifications/events/notification.events';
import { Profile } from '../entities/profile.entity';
import { ProfilesService } from '../profiles.service';
import { Follow } from './entities/follow.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly profilesService: ProfilesService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async follow(userId: number, followedId: number): Promise<Follow> {
    const followerObj = await this.profilesService.findByUserId(userId);
    if (followerObj.id === followedId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }
    await this.profilesService.findOne(followedId);

    const existingFollowObj = await this.followRepository.findOneBy({
      followerId: followerObj.id,
      followedId,
    });
    if (existingFollowObj) {
      throw new ConflictException('Ya sigues a este perfil');
    }

    const followObj = await this.dataSource.transaction(async (manager) => {
      const savedFollowObj = await manager.save(
        manager.create(Follow, { followerId: followerObj.id, followedId }),
      );
      await manager.increment(Profile, { id: followedId }, 'followersCount', 1);
      return savedFollowObj;
    });

    await this.eventEmitter.emitAsync(NotificationEvents.PROFILE_FOLLOWED, {
      followerId: followerObj.id,
      followedId,
    } satisfies ProfileFollowedEvent);
    return followObj;
  }

  async unfollow(
    userId: number,
    followedId: number,
  ): Promise<{ message: string }> {
    const followerObj = await this.profilesService.findByUserId(userId);
    const followObj = await this.followRepository.findOneBy({
      followerId: followerObj.id,
      followedId,
    });
    if (!followObj) {
      throw new NotFoundException('No sigues a este perfil');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(followObj);
      await manager.decrement(Profile, { id: followedId }, 'followersCount', 1);
    });
    return { message: `Dejaste de seguir al perfil #${followedId}` };
  }

  async isFollowing(followerId: number, followedId: number): Promise<boolean> {
    return await this.followRepository.existsBy({ followerId, followedId });
  }

  async findFollowers(profileId: number): Promise<Profile[]> {
    await this.profilesService.findOne(profileId);
    const followObjs = await this.followRepository.find({
      where: { followedId: profileId },
      relations: { follower: true },
    });
    return followObjs.map((followObj) => followObj.follower);
  }

  async findFollowing(profileId: number): Promise<Profile[]> {
    await this.profilesService.findOne(profileId);
    const followObjs = await this.followRepository.find({
      where: { followerId: profileId },
      relations: { followed: true },
    });
    return followObjs.map((followObj) => followObj.followed);
  }
}
