import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { UserPreferencesResolver } from './user-preferences.resolver';

@Module({
  imports: [SharedModule],
  providers: [UserPreferencesResolver],
})
export class UserPreferencesModule {}
