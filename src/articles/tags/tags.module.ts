import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../articles.module';
import { ArticleTag } from './entities/article-tag.entity';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleTag]),
    forwardRef(() => ArticlesModule),
  ],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}