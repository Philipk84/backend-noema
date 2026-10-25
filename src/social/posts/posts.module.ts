import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from '../../articles/articles.module';
import { MembershipsModule } from '../../communities/memberships/memberships.module';
import { FollowsModule } from '../../profiles/follows/follows.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { Post } from './entities/post.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    ProfilesModule,
    ArticlesModule,
    FollowsModule,
    MembershipsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}