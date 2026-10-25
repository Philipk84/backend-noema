import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Profile } from '../../entities/profile.entity';

@Entity('follows')
export class Follow {
  @ApiProperty({ description: 'Identificador del perfil seguidor', example: 1 })
  @PrimaryColumn({ name: 'follower_id' })
  followerId: number;

  @ApiProperty({ description: 'Identificador del perfil seguido', example: 2 })
  @PrimaryColumn({ name: 'followed_id' })
  followedId: number;

  @ApiProperty({
    description: 'Fecha en que se empezó a seguir al perfil',
    example: '2026-10-10T22:30:58.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'follower_id' })
  follower: Profile;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'followed_id' })
  followed: Profile;
}
