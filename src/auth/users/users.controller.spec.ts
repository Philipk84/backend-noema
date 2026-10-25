import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = { create: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delega en el servicio', async () => {
    const createUserDto = {
      email: 'ana@noema.com',
      password: 'Password123',
      roleIds: [1],
    };
    usersService.create.mockResolvedValue({ id: 1 });

    await expect(controller.create(createUserDto)).resolves.toEqual({ id: 1 });
    expect(usersService.create).toHaveBeenCalledWith(createUserDto);
  });
});
