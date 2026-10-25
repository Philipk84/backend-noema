import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from '../../communities/memberships/memberships.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { Payment } from '../payments/entities/payment.entity';
import { PlansModule } from '../plans/plans.module';
import { Subscription } from './entities/subscription.entity';
import {
  PaymentGateway,
  SimulatedPaymentGateway,
} from './gateway/payment-gateway';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    // Payment se registra aquí porque cada cobro se guarda junto con su suscripción
    TypeOrmModule.forFeature([Subscription, Payment]),
    ProfilesModule,
    PlansModule,
    MembershipsModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    // Para usar una pasarela real, cambiar useClass por su implementación de PaymentGateway
    { provide: PaymentGateway, useClass: SimulatedPaymentGateway },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
