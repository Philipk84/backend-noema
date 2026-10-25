import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileNotFoundException } from '../common/exceptions';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfilesService {
   constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  async create(
    userId: number,
    createProfileDto: CreateProfileDto,
  ): Promise<Profile> {
    const existingUserProfileObj = await this.profileRepository.findOneBy({
      userId,
    });
    if (existingUserProfileObj) {
      throw new ConflictException('El usuario ya tiene un perfil creado');
    }
    await this.assertUsernameAvailable(createProfileDto.username);

    const profileObj = this.profileRepository.create({
      ...createProfileDto,
      userId,
    });
    return await this.profileRepository.save(profileObj);
  }

  async findAll(): Promise<Profile[]> {
    return await this.profileRepository.find();
  }

  async findOne(id: number): Promise<Profile> {
    const profileObj = await this.profileRepository.findOneBy({ id });
    if (!profileObj) {
      throw new ProfileNotFoundException(id);
    }
    return profileObj;
  }

  /** Perfil del usuario autenticado; falla si el usuario aún no tiene uno. */
  async findByUserId(userId: number): Promise<Profile> {
    const profileObj = await this.profileRepository.findOneBy({ userId });
    if (!profileObj) {
      throw new ProfileNotFoundException(userId, 'USER_WITHOUT_PROFILE');
    }
    return profileObj;
  }

  /** Como findByUserId, pero devuelve null en lugar de lanzar si no hay perfil. */
  async findByUserIdOrNull(userId: number): Promise<Profile | null> {
    return await this.profileRepository.findOneBy({ userId });
  }

  async update(
    userId: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Profile> {
    const profileObj = await this.findByUserId(userId);
    if (
      updateProfileDto.username &&
      updateProfileDto.username !== profileObj.username
    ) {
      await this.assertUsernameAvailable(updateProfileDto.username);
    }
    this.profileRepository.merge(profileObj, updateProfileDto);
    return await this.profileRepository.save(profileObj);
  }

  async remove(userId: number): Promise<{ message: string }> {
    const profileObj = await this.findByUserId(userId);
    await this.profileRepository.remove(profileObj);
    return {
      message: `Profile with id #${profileObj.id} deleted successfully`,
    };
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    const existingProfileObj = await this.profileRepository.findOneBy({
      username,
    });
    if (existingProfileObj) {
      throw new ConflictException(`El username '${username}' ya está en uso`);
    }
  }
}
