import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { MembershipStatus } from '../enums/membership.enums';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

describe('MembershipsController', () => {
  let controller: MembershipsController;
  const membershipsService = {
    join: jest.fn(),
    findMembers: jest.fn(),
    update: jest.fn(),
    kick: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [
        { provide: MembershipsService, useValue: membershipsService },
      ],
    }).compile();

    controller = module.get<MembershipsController>(MembershipsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('join usa el id del usuario autenticado', async () => {
    await controller.join({ id: 9 } as User, 3);
    expect(membershipsService.join).toHaveBeenCalledWith(9, 3);
  });

  it('findMembers pasa el usuario, o null si es anónimo', async () => {
    const query = { page: 1, limit: 20 };
    await controller.findMembers({ id: 9 } as User, 3, query);
    await controller.findMembers(null, 3, query);
    expect(membershipsService.findMembers).toHaveBeenNthCalledWith(
      1,
      3,
      9,
      query,
    );
    expect(membershipsService.findMembers).toHaveBeenNthCalledWith(
      2,
      3,
      null,
      query,
    );
  });

  it('update y kick delegan con el usuario, la comunidad y el perfil', async () => {
    await controller.update({ id: 9 } as User, 3, 5, {
      status: MembershipStatus.BANNED,
    });
    await controller.kick({ id: 9 } as User, 3, 5);
    expect(membershipsService.update).toHaveBeenCalledWith(9, 3, 5, {
      status: MembershipStatus.BANNED,
    });
    expect(membershipsService.kick).toHaveBeenCalledWith(9, 3, 5);
  });
});
