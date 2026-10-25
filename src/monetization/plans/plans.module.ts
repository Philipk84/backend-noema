import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunitiesModule } from '../../communities/communities.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [
    // Subscription solo se registra para contar suscripciones antes de borrar un plan
    TypeOrmModule.forFeature([Plan, Subscription]),
    ProfilesModule,
    CommunitiesModule,
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
