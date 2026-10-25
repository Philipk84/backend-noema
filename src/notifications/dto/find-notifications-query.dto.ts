import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationType } from '../enums/notification.enums';

export class FindNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'unread debe ser true o false' })
  unread?: boolean;

  @IsOptional()
  @IsEnum(NotificationType, {
    message:
      'El tipo debe ser FOLLOW, COMMENT, REACTION, POST_IN_COMMUNITY o MEMBERSHIP',
  })
  type?: NotificationType;
}