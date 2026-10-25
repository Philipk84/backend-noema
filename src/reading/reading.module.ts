import { Module } from '@nestjs/common';
import { ReadingListsModule } from './reading-lists/reading-lists.module';
import { ProgressModule } from './progress/progress.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { FavoritesModule } from './favorites/favorites.module';

@Module({
  imports: [ReadingListsModule, ProgressModule, BookmarksModule, FavoritesModule]
})
export class ReadingModule {}
