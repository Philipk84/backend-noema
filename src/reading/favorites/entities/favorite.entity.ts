import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Profile } from '../../../profiles/entities/profile.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryColumn({ name: 'profile_id' })
  profileId: number;

  @PrimaryColumn({ name: 'article_id' })
  articleId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @ManyToOne(() => Article, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'article_id' })
  article: Article;
}