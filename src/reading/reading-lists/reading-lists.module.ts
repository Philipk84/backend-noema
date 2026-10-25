import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../../articles/articles.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { ReadingListItem } from './entities/reading-list-item.entity';
import { ReadingList } from './entities/reading-list.entity';
import { ReadingListsController } from './reading-lists.controller';
import { ReadingListsService } from './reading-lists.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingList, ReadingListItem]),
    ProfilesModule,
    ArticlesModule,
  ],
  controllers: [ReadingListsController],
  providers: [ReadingListsService],
})
export class ReadingListsModule {}
