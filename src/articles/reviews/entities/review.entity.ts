import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Profile } from '../../../profiles/entities/profile.entity';
import { Article } from '../../entities/article.entity';

// Un perfil solo puede reseñar una vez cada artículo
@Entity('reviews')
@Unique(['profileId', 'articleId'])
export class Review {
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

  // De 1 a 5
  @Column({ type: 'smallint' })
  rating: number;

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
