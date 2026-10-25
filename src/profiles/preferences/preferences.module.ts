import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { UserPreference } from './entities/preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPreference]),
    forwardRef(() => ProfilesModule),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
