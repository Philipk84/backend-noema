import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Community } from '../../../communities/entities/community.entity';
import { Profile } from '../../../profiles/entities/profile.entity';
import { PostType, PostVisibility } from '../../enums/post.enums';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: Profile;

  // Comunidad del post, obligatoria cuando la visibilidad es COMMUNITY
  @Column({ name: 'community_id', type: 'int', nullable: true })
  communityId: number | null;

  @ManyToOne(() => Community, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'community_id' })
  community?: Community | null;

  @Column({ name: 'article_id', type: 'int', nullable: true })
  articleId: number | null;

  @ManyToOne(() => Article, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'article_id' })
  article?: Article | null;

  @Column({ name: 'parent_post_id', type: 'int', nullable: true })
  parentPostId: number | null;

  @ManyToOne(() => Post, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_post_id' })
  parentPost?: Post | null;

  @Column({
    name: 'post_type',
    type: 'enum',
    enum: PostType,
    default: PostType.ORIGINAL,
  })
  postType: PostType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({
    type: 'enum',
    enum: PostVisibility,
    default: PostVisibility.PUBLIC,
  })
  visibility: PostVisibility;

  @Column({ default: 0 })
  likes: number;

  @Column({ name: 'repost_count', default: 0 })
  repostCount: number;

  @Column({ name: 'comment_count', default: 0 })
  commentCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}