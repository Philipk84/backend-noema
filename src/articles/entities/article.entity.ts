import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity';
import { Community } from '../../communities/entities/community.entity';
import { Collection } from '../collections/entities/collection.entity';
import { ArticleTag } from '../tags/entities/article-tag.entity';
import { ArticleStatus } from '../enums/article-status.enum';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'author_id' })
  authorId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'author_id' })
  author: Profile;

  @Column({ name: 'collection_id', type: 'int', nullable: true })
  collectionId: number | null;

  @ManyToOne(() => Collection, (collectionObj) => collectionObj.articles, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'collection_id' })
  collection?: Collection | null;

  @Column({ name: 'community_id', type: 'int', nullable: true })
  communityId: number | null;

  @ManyToOne(() => Community, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'community_id' })
  community?: Community | null;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ type: 'text', select: false })
  content: string;


  locked?: boolean;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ArticleTag, (articleTagObj) => articleTagObj.article)
  articleTags: ArticleTag[];
}
