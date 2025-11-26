import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import {
  CreateUserRecommendationPreferencesDto,
  RecommendationWeights,
  UpdateUserRecommendationPreferencesDto,
  UserRecommendationPreferences,
} from '../interfaces/recommendation.interface';
import { DEFAULT_RECOMMENDATION_WEIGHTS } from './recommendation.service';

@Injectable()
export class UserRecommendationPreferencesService {
  private readonly logger = new Logger(
    UserRecommendationPreferencesService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async createPreferences(
    dto: CreateUserRecommendationPreferencesDto,
  ): Promise<UserRecommendationPreferences> {
    try {
      const preferences =
        await this.prisma.userRecommendationPreferences.create({
          data: {
            userId: dto.userId,
            weights: JSON.stringify(dto.weights),
            isDefault: dto.isDefault || false,
          },
        });

      return {
        ...preferences,
        weights: JSON.parse(preferences.weights),
      };
    } catch (error) {
      this.logger.error(
        'Error creating user recommendation preferences:',
        error,
      );
      throw error;
    }
  }

  async updatePreferences(
    id: string,
    dto: UpdateUserRecommendationPreferencesDto,
  ): Promise<UserRecommendationPreferences> {
    try {
      const updateData: any = {};

      if (dto.weights) {
        updateData.weights = JSON.stringify(dto.weights);
      }

      if (dto.isDefault !== undefined) {
        updateData.isDefault = dto.isDefault;
      }

      const preferences =
        await this.prisma.userRecommendationPreferences.update({
          where: { id },
          data: updateData,
        });

      return {
        ...preferences,
        weights: JSON.parse(preferences.weights),
      };
    } catch (error) {
      this.logger.error(
        'Error updating user recommendation preferences:',
        error,
      );
      throw error;
    }
  }

  async getPreferencesByUserId(
    userId: string,
  ): Promise<UserRecommendationPreferences | null> {
    try {
      const preferences =
        await this.prisma.userRecommendationPreferences.findFirst({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });

      if (!preferences) {
        return null;
      }

      return {
        ...preferences,
        weights: JSON.parse(preferences.weights),
      };
    } catch (error) {
      this.logger.error(
        'Error getting user recommendation preferences:',
        error,
      );
      throw error;
    }
  }

  async getDefaultPreferences(): Promise<RecommendationWeights> {
    try {
      const preferences =
        await this.prisma.userRecommendationPreferences.findFirst({
          where: { isDefault: true },
          orderBy: { updatedAt: 'desc' },
        });

      if (preferences) {
        return JSON.parse(preferences.weights);
      }

      return DEFAULT_RECOMMENDATION_WEIGHTS;
    } catch (error) {
      this.logger.error(
        'Error getting default recommendation preferences:',
        error,
      );
      return DEFAULT_RECOMMENDATION_WEIGHTS;
    }
  }

  async deletePreferences(id: string): Promise<void> {
    try {
      await this.prisma.userRecommendationPreferences.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        'Error deleting user recommendation preferences:',
        error,
      );
      throw error;
    }
  }

  async validateWeights(weights: RecommendationWeights): Promise<boolean> {
    const totalWeight = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    // Allow some tolerance for floating point precision
    return Math.abs(totalWeight - 1.0) < 0.01;
  }

  async normalizeWeights(
    weights: RecommendationWeights,
  ): Promise<RecommendationWeights> {
    const totalWeight = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    if (totalWeight === 0) {
      return DEFAULT_RECOMMENDATION_WEIGHTS;
    }

    const normalizedWeights: RecommendationWeights =
      {} as RecommendationWeights;

    for (const [key, value] of Object.entries(weights)) {
      normalizedWeights[key as keyof RecommendationWeights] =
        value / totalWeight;
    }

    return normalizedWeights;
  }
}
