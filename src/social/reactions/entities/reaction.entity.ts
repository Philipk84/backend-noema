import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Profile } from '../../../profiles/entities/profile.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { ReactionType } from '../../enums/reaction.enums';
import { Post } from '../../posts/entities/post.entity';

// Una reacción apunta a exactamente un recurso y un perfil reacciona una sola vez por recurso.
// Las restricciones únicas ignoran los NULL, por eso hay una por cada tipo de recurso.
@Entity('reactions')
@Unique(['profileId', 'articleId'])
@Unique(['profileId', 'postId'])
@Unique(['profileId', 'commentId'])
@Check(
  '(("article_id" IS NOT NULL)::int + ("post_id" IS NOT NULL)::int + ("comment_id" IS NOT NULL)::int) = 1',
)
export class Reaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'profile_id' })
  profileId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'article_id', type: 'int', nullable: true })
  articleId: number | null;

  @ManyToOne(() => Article, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'article_id' })
  article?: Article | null;

  @Column({ name: 'post_id', type: 'int', nullable: true })
  postId: number | null;

  @ManyToOne(() => Post, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'post_id' })
  post?: Post | null;

  @Column({ name: 'comment_id', type: 'int', nullable: true })
  commentId: number | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'comment_id' })
  comment?: Comment | null;

  @Column({ type: 'enum', enum: ReactionType })
  type: ReactionType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}