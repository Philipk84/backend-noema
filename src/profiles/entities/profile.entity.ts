import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/users/entities/user.entity';

@Entity('profiles')
export class Profile {
  @ApiProperty({ description: 'Identificador del perfil', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Identificador del usuario dueño del perfil',
    example: 7,
  })
  @Column({ name: 'user_id', unique: true })
  userId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({
    description: 'Nombre de usuario único',
    example: 'maria.lopez',
  })
  @Column({ unique: true, length: 50 })
  username: string;

  @ApiProperty({
    description: 'Nombre visible del perfil',
    example: 'María López',
  })
  @Column({ length: 100 })
  name: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil',
    example: 'https://example.com/avatars/maria.png',
  })
  @Column({ name: 'profile_photo', length: 500, nullable: true })
  profilePhoto?: string;

  @ApiPropertyOptional({
    description: 'Biografía del perfil',
    example: 'Escritora y lectora apasionada de ciencia ficción',
  })
  @Column({ type: 'text', nullable: true })
  bio?: string;

  @ApiPropertyOptional({
    description: 'URL del sitio web personal',
    example: 'https://maria-lopez.dev',
  })
  @Column({ length: 255, nullable: true })
  website?: string;

  @ApiPropertyOptional({
    description: 'Enlaces a redes sociales con el formato { red: url }',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { twitter: 'https://twitter.com/marialopez' },
  })
  @Column({ name: 'social_links', type: 'jsonb', nullable: true })
  socialLinks?: Record<string, string>;

  @ApiProperty({
    description: 'Indica si el perfil está verificado',
    example: false,
  })
  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @ApiProperty({
    description: 'Cantidad de seguidores del perfil',
    example: 42,
  })
  @Column({ name: 'followers_count', default: 0 })
  followersCount: number;

  @ApiProperty({
    description: 'Fecha de creación del perfil',
    example: '2026-10-10T22:30:58.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
