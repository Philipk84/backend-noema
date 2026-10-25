import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Profile } from '../../../profiles/entities/profile.entity';

@Entity('bookmarks')
export class Bookmark {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'profile_id' })
  profileId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'article_id' })
  articleId: number;

  @ManyToOne(() => Article, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'highlighted_text', type: 'text' })
  highlightedText: string;

  @Column({ name: 'start_position', type: 'int' })
  startPosition: number;

  @Column({ name: 'end_position', type: 'int' })
  endPosition: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
