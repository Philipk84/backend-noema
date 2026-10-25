import { PartialType } from '@nestjs/mapped-types';
import { CreateReadingListDto } from './create-reading-list.dto';

export class UpdateReadingListDto extends PartialType(CreateReadingListDto) {}
