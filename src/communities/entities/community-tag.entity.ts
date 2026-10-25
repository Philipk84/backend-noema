import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Community } from './community.entity';

/** Etiqueta de una comunidad. Texto libre, independiente de las etiquetas de artículos. */
@Entity('community_tags')
export class CommunityTag {
  @PrimaryColumn({ name: 'community_id' })
  communityId: number;

  @PrimaryColumn({ length: 50 })
  tag: string;

  @ManyToOne(() => Community, (communityObj) => communityObj.tags, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'community_id' })
  community: Community;
}
