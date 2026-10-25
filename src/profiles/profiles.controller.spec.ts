import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../auth/users/entities/user.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

describe('ProfilesController', () => {
  let controller: ProfilesController;
  const profilesService = { create: jest.fn(), findByUserId: jest.fn() };
  const userObj = { id: 9 } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [{ provide: ProfilesService, useValue: profilesService }],
    }).compile();

    controller = module.get<ProfilesController>(ProfilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createProfileDto = { username: 'ana_dev', name: 'Ana' };
    profilesService.create.mockResolvedValue({ id: 1 });

    await controller.create(userObj, createProfileDto);
    expect(profilesService.create).toHaveBeenCalledWith(9, createProfileDto);
  });

  it('findMine busca el perfil por el id del usuario autenticado', async () => {
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    await expect(controller.findMine(userObj)).resolves.toEqual({ id: 1 });
    expect(profilesService.findByUserId).toHaveBeenCalledWith(9);
  });
});