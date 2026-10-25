import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity';
import { CommunityTag } from './community-tag.entity';

@Entity('communities')
export class Community {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: Profile;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ length: 100 })
  topic: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Las membresías de una comunidad premium quedan PENDING hasta que se aprueben
  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => CommunityTag, (communityTagObj) => communityTagObj.community)
  tags: CommunityTag[];
}
