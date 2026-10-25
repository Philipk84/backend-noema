import { IsEnum } from 'class-validator';
import { ReactionType } from '../../enums/reaction.enums';

export class SetReactionDto {
  @IsEnum(ReactionType, {
    message: 'El tipo debe ser LIKE, LOVE o INSIGHTFUL',
  })
  type: ReactionType;
}