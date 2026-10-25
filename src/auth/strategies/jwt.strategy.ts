import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RevokedToken } from '../entities/revoked-token.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(RevokedToken)
    private readonly revokedTokensRepository: Repository<RevokedToken>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('La variable de entorno JWT_SECRET no está configurada');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.jti) {
      const revokedToken = await this.revokedTokensRepository.findOneBy({
        jti: payload.jti,
      });
      if (revokedToken) {
        throw new UnauthorizedException('La sesión ya fue cerrada');
      }
    }

    const userObj = await this.usersService.findOne(payload.sub, true);
    if (!userObj.isActive) {
      throw new UnauthorizedException(
        'El token no corresponde a un usuario activo',
      );
    }
    return userObj;
  }
}
