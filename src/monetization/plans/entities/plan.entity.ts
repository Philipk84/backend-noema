import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Community } from '../../../communities/entities/community.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';
import { Profile } from '../../../profiles/entities/profile.entity';
import { BillingPeriod } from '../../enums/monetization.enums';

// Un plan pertenece a un autor (da acceso a sus artículos premium) o a una comunidad, nunca a ambos
@Entity('plans')
@Check('("author_id" IS NULL) <> ("community_id" IS NULL)')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'author_id', type: 'int', nullable: true })
  authorId: number | null;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author?: Profile | null;

  @Column({ name: 'community_id', type: 'int', nullable: true })
  communityId: number | null;

  @ManyToOne(() => Community, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'community_id' })
  community?: Community | null;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  // Código ISO 4217 en mayúsculas
  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'billing_period', type: 'enum', enum: BillingPeriod })
  billingPeriod: BillingPeriod;

  // Un plan retirado no admite suscripciones nuevas, pero conserva las existentes
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
