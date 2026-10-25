import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { MembershipRole, MembershipStatus } from '../../enums/membership.enums';

export class UpdateMembershipDto {
  // OWNER no se asigna; el propietario se define al crear la comunidad
  @IsOptional()
  @IsIn([MembershipRole.MEMBER, MembershipRole.MODERATOR], {
    message: 'El rol debe ser MEMBER o MODERATOR',
  })
  role?: MembershipRole.MEMBER | MembershipRole.MODERATOR;

  // PENDING no se asigna: es el estado inicial de una solicitud
  @IsOptional()
  @IsIn([MembershipStatus.ACTIVE, MembershipStatus.BANNED], {
    message: 'El estado debe ser ACTIVE o BANNED',
  })
  status?: MembershipStatus.ACTIVE | MembershipStatus.BANNED;
}

export class FindMembersQueryDto extends PaginationQueryDto {
  // Ver miembros PENDING o BANNED solo está permitido a propietario y moderadores
  @IsOptional()
  @IsEnum(MembershipStatus, {
    message: 'El estado debe ser ACTIVE, PENDING o BANNED',
  })
  status?: MembershipStatus;
}
