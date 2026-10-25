import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity';
import {
  NotificationReferenceType,
  NotificationType,
} from '../enums/notification.enums';

@Entity('notifications')
@Index(['recipientId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'recipient_id' })
  recipientId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'recipient_id' })
  recipient: Profile;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: Profile | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: NotificationReferenceType,
  })
  referenceType: NotificationReferenceType;

  @Column({ name: 'reference_id' })
  referenceId: number;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}