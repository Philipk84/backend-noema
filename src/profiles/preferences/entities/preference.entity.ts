import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Profile } from '../../entities/profile.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryColumn({ name: 'profile_id' })
  profileId: number;

  @PrimaryColumn({ length: 50 })
  tag: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;
}