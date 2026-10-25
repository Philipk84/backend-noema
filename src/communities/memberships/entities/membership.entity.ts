import {
  CreateDateColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Profile } from '../../../profiles/entities/profile.entity';
import { Community } from '../../entities/community.entity';
import { MembershipRole, MembershipStatus } from '../../enums/membership.enums';

@Entity('memberships')
export class Membership {
  @PrimaryColumn({ name: 'profile_id' })
  profileId: number;

  @PrimaryColumn({ name: 'community_id' })
  communityId: number;

  @Column({
    type: 'enum',
    enum: MembershipRole,
    default: MembershipRole.MEMBER,
  })
  role: MembershipRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @ManyToOne(() => Community, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'community_id' })
  community: Community;
}
