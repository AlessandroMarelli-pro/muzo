import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateUserRecommendationPreferencesDto,
  UpdateUserRecommendationPreferencesDto,
} from '../interfaces/recommendation.interface';
import { UserRecommendationPreferencesService } from '../services/user-recommendation-preferences.service';

@Controller('user-recommendation-preferences')
export class UserRecommendationPreferencesController {
  constructor(
    private readonly userPreferencesService: UserRecommendationPreferencesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPreferences(@Body() dto: CreateUserRecommendationPreferencesDto) {
    return this.userPreferencesService.createPreferences(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @Param('id') id: string,
    @Body() dto: UpdateUserRecommendationPreferencesDto,
  ) {
    return this.userPreferencesService.updatePreferences(id, dto);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  async getPreferencesByUserId(@Param('userId') userId: string) {
    return this.userPreferencesService.getPreferencesByUserId(userId);
  }

  @Get('default')
  @HttpCode(HttpStatus.OK)
  async getDefaultPreferences() {
    return this.userPreferencesService.getDefaultPreferences();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePreferences(@Param('id') id: string) {
    await this.userPreferencesService.deletePreferences(id);
  }

  @Post('validate-weights')
  @HttpCode(HttpStatus.OK)
  async validateWeights(@Body() weights: any) {
    const isValid = await this.userPreferencesService.validateWeights(weights);
    return { isValid };
  }

  @Post('normalize-weights')
  @HttpCode(HttpStatus.OK)
  async normalizeWeights(@Body() weights: any) {
    return this.userPreferencesService.normalizeWeights(weights);
  }
}
