export class Progress {}
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Profile } from '../../../profiles/entities/profile.entity';

@Entity('reading_progress')
export class ReadingProgress {
  @PrimaryColumn({ name: 'profile_id' })
  profileId: number;

  @PrimaryColumn({ name: 'article_id' })
  articleId: number;

  // De 0 a 100. numeric llega como texto desde pg, por eso se convierte a número
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  percentage: number;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ name: 'last_read_at', type: 'timestamptz' })
  lastReadAt: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @ManyToOne(() => Article, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'article_id' })
  article: Article;
}