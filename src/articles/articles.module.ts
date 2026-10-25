import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from '../communities/memberships/memberships.module';
import { SubscriptionsModule } from '../monetization/subscriptions/subscriptions.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { CollectionsModule } from './collections/collections.module';
import { Article } from './entities/article.entity';
import { ReviewsModule } from './reviews/reviews.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article]),
    ProfilesModule,
    CollectionsModule,
    MembershipsModule,
    SubscriptionsModule,
    forwardRef(() => ReviewsModule),
    forwardRef(() => TagsModule),
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
