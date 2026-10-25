import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationEvents } from '../../notifications/events/notification.events';
import { Profile } from '../entities/profile.entity';
import { ProfilesService } from '../profiles.service';
import { Follow } from './entities/follow.entity';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;
  const followRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    existsBy: jest.fn(),
  };
  const eventEmitter = { emitAsync: jest.fn() };
  const profilesService = { findByUserId: jest.fn(), findOne: jest.fn() };
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('follow', () => {
    it('crea el follow e incrementa el contador en una transacción', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      profilesService.findOne.mockResolvedValue({ id: 2 });
      followRepository.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue({ followerId: 1, followedId: 2 });
      manager.save.mockResolvedValue({ followerId: 1, followedId: 2 });

      await service.follow(9, 2);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(manager.increment).toHaveBeenCalledWith(
        Profile,
        { id: 2 },
        'followersCount',
        1,
      );
    });

    it('emite el evento PROFILE_FOLLOWED tras crear el follow', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      profilesService.findOne.mockResolvedValue({ id: 2 });
      followRepository.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue({ followerId: 1, followedId: 2 });
      manager.save.mockResolvedValue({ followerId: 1, followedId: 2 });

      await service.follow(9, 2);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        NotificationEvents.PROFILE_FOLLOWED,
        { followerId: 1, followedId: 2 },
      );
    });

    it('no emite el evento si la transacción falla', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      profilesService.findOne.mockResolvedValue({ id: 2 });
      followRepository.findOneBy.mockResolvedValue(null);
      manager.create.mockReturnValue({ followerId: 1, followedId: 2 });
      manager.save.mockRejectedValue(new Error('db'));

      await expect(service.follow(9, 2)).rejects.toThrow('db');
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('no permite seguirse a sí mismo', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      await expect(service.follow(9, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si ya lo sigue', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      profilesService.findOne.mockResolvedValue({ id: 2 });
      followRepository.findOneBy.mockResolvedValue({ followerId: 1 });
      await expect(service.follow(9, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('elimina el follow y decrementa el contador', async () => {
      const followObj = { followerId: 1, followedId: 2 };
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      followRepository.findOneBy.mockResolvedValue(followObj);

      await service.unfollow(9, 2);

      expect(manager.remove).toHaveBeenCalledWith(followObj);
      expect(manager.decrement).toHaveBeenCalledWith(
        Profile,
        { id: 2 },
        'followersCount',
        1,
      );
    });

    it('lanza NotFoundException si no lo seguía', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 1 });
      followRepository.findOneBy.mockResolvedValue(null);
      await expect(service.unfollow(9, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('isFollowing', () => {
    it('delega en existsBy', async () => {
      followRepository.existsBy.mockResolvedValue(true);
      await expect(service.isFollowing(1, 2)).resolves.toBe(true);
      expect(followRepository.existsBy).toHaveBeenCalledWith({
        followerId: 1,
        followedId: 2,
      });
    });
  });

  describe('findFollowers', () => {
    it('devuelve los perfiles seguidores', async () => {
      profilesService.findOne.mockResolvedValue({ id: 2 });
      followRepository.find.mockResolvedValue([
        { follower: { id: 1 } },
        { follower: { id: 3 } },
      ]);
      await expect(service.findFollowers(2)).resolves.toEqual([
        { id: 1 },
        { id: 3 },
      ]);
    });
  });
});
