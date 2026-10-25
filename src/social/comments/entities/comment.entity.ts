import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { Profile } from '../../../profiles/entities/profile.entity';
import { Post } from '../../posts/entities/post.entity';

// Un comentario pertenece a un artículo o a una publicación, nunca a ambos
@Entity('comments')
@Check('("article_id" IS NULL) <> ("post_id" IS NULL)')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'author_id' })
  authorId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'author_id' })
  author: Profile;

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

  // Comentario al que responde; al borrarlo se borran sus respuestas
  @Column({ name: 'parent_comment_id', type: 'int', nullable: true })
  parentCommentId: number | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment?: Comment | null;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}