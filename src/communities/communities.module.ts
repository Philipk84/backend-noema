import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/entities/article.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityTag } from './entities/community-tag.entity';
import { Community } from './entities/community.entity';
import { Membership } from './memberships/entities/membership.entity';
import { MembershipsModule } from './memberships/memberships.module';

@Module({
  imports: [
    // Article solo se registra para contar artículos exclusivos al borrar la comunidad
    TypeOrmModule.forFeature([Community, CommunityTag, Membership, Article]),
    ProfilesModule,
    forwardRef(() => MembershipsModule),
  ],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
