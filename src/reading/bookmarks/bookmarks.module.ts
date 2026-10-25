import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../../articles/articles.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './entities/bookmark.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bookmark]),
    ProfilesModule,
    ArticlesModule,
  ],
  controllers: [BookmarksController],
  providers: [BookmarksService],
})
export class BookmarksModule {}
