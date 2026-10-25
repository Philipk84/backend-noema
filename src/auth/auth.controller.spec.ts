import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = { login: jest.fn(), logout: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login delega en el servicio', async () => {
    const userLoginDto = { email: 'ana@noema.com', password: 'Password123' };
    authService.login.mockResolvedValue({ access_token: 't' });

    await expect(controller.login(userLoginDto)).resolves.toEqual({
      access_token: 't',
    });
    expect(authService.login).toHaveBeenCalledWith(userLoginDto);
  });

  it('logout delega el token Bearer en el servicio', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as any;
    authService.logout.mockResolvedValue({
      message: 'Sesión cerrada correctamente',
    });

    await expect(controller.logout(request)).resolves.toEqual({
      message: 'Sesión cerrada correctamente',
    });
    expect(authService.logout).toHaveBeenCalledWith('test-token');
  });
});
