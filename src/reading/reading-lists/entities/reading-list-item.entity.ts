import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Article } from '../../../articles/entities/article.entity';
import { ReadingList } from './reading-list.entity';

@Entity('reading_list_items')
export class ReadingListItem {
  @PrimaryColumn({ name: 'reading_list_id' })
  readingListId: number;

  @PrimaryColumn({ name: 'article_id' })
  articleId: number;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ReadingList, (readingListObj) => readingListObj.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'reading_list_id' })
  readingList: ReadingList;

  @ManyToOne(() => Article, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'article_id' })
  article: Article;
}
