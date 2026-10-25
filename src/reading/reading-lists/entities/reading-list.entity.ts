import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from '../../../profiles/entities/profile.entity';
import {
  ReadingListStatus,
  ReadingListVisibility,
} from '../../enums/reading-list-status.enum';
import { ReadingListItem } from './reading-list-item.entity';

@Entity('reading_lists')
export class ReadingList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'profile_id' })
  profileId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ReadingListStatus,
    default: ReadingListStatus.CUSTOM,
  })
  status: ReadingListStatus;

  @Column({
    type: 'enum',
    enum: ReadingListVisibility,
    default: ReadingListVisibility.PRIVATE,
  })
  visibility: ReadingListVisibility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ReadingListItem, (itemObj) => itemObj.readingList)
  items: ReadingListItem[];
}
