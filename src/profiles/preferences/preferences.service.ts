import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfilesService } from '../profiles.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { UserPreference } from './entities/preference.entity';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepository: Repository<UserPreference>,
    private readonly profilesService: ProfilesService,
  ) {}

  async findMine(userId: number): Promise<string[]> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const userPreferenceObjs = await this.userPreferenceRepository.find({
      where: { profileId: profileObj.id },
      order: { tag: 'ASC' },
    });
    return userPreferenceObjs.map((userPreferenceObj) => userPreferenceObj.tag);
  }

  async replaceMine(
    userId: number,
    createPreferenceDto: CreatePreferenceDto,
  ): Promise<string[]> {
    const profileObj = await this.profilesService.findByUserId(userId);
    // Se normaliza para que "Node" y "node" no sean preferencias distintas
    const tags = [
      ...new Set(
        createPreferenceDto.tags.map((tag) => tag.trim().toLowerCase()),
      ),
    ].filter((tag) => tag.length > 0);

    await this.userPreferenceRepository.delete({ profileId: profileObj.id });
    const userPreferenceObjs = tags.map((tag) =>
      this.userPreferenceRepository.create({ profileId: profileObj.id, tag }),
    );
    await this.userPreferenceRepository.save(userPreferenceObjs);
    return await this.findMine(userId);
  }
}