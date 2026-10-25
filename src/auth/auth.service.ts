import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { LessThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserLoginDto } from './dto/user-login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RevokedToken } from './entities/revoked-token.entity';
import { UsersService } from './users/users.service';
import {
  extractPermissionNames,
  extractRoleNames,
} from './utils/user-access.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RevokedToken)
    private readonly revokedTokensRepository: Repository<RevokedToken>,
  ) {}

  async login(userLoginDto: UserLoginDto) {
    const userObj = await this.usersService.findByEmail(userLoginDto.email);

    // Mismo mensaje para usuario inexistente y contraseña errónea: no revela qué correos existen
    const isMatch =
      !!userObj &&
      (await bcrypt.compare(userLoginDto.password, userObj.password));
    if (!userObj || !isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!userObj.isActive) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }

    const roles = extractRoleNames(userObj);
    const payload: JwtPayload = {
      sub: userObj.id,
      email: userObj.email,
      roles,
      permissions: extractPermissionNames(userObj),
      jti: randomUUID(),
    };

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      user: { id: userObj.id, email: userObj.email, roles },
    };
  }

  async logout(token: string): Promise<{ message: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('El token no es válido');
    }

    if (!payload.jti || !payload.exp) {
      throw new UnauthorizedException('El token no permite cerrar la sesión');
    }

    await this.revokedTokensRepository.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });
    await this.revokedTokensRepository.save(
      this.revokedTokensRepository.create({
        jti: payload.jti,
        expiresAt: new Date(payload.exp * 1000),
      }),
    );

    return { message: 'Sesión cerrada correctamente' };
  }
}
