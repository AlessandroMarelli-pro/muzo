import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

// GraphQL Input Types
@InputType()
export class AnalysisPreferencesInput {
  @Field({ nullable: true })
  autoAnalyze?: boolean;

  @Field({ nullable: true })
  confidenceThreshold?: number;

  @Field(() => [String], { nullable: true })
  preferredGenres?: string[];

  @Field({ nullable: true })
  skipLowConfidence?: boolean;
}

@InputType()
export class OrganizationPreferencesInput {
  @Field({ nullable: true })
  autoOrganize?: boolean;

  @Field({ nullable: true })
  organizationMethod?: string;

  @Field({ nullable: true })
  createPlaylists?: boolean;

  @Field({ nullable: true })
  exportToDJSoftware?: boolean;
}

@InputType()
export class EditorPreferencesInput {
  @Field({ nullable: true })
  showConfidenceScores?: boolean;

  @Field({ nullable: true })
  batchMode?: boolean;

  @Field({ nullable: true })
  autoSave?: boolean;

  @Field({ nullable: true })
  undoLevels?: number;
}

@InputType()
export class UIPreferencesInput {
  @Field({ nullable: true })
  theme?: string;

  @Field({ nullable: true })
  language?: string;

  @Field({ nullable: true })
  defaultView?: string;
}

@InputType()
export class UpdatePreferencesInput {
  @Field(() => AnalysisPreferencesInput, { nullable: true })
  analysisPreferences?: AnalysisPreferencesInput;

  @Field(() => OrganizationPreferencesInput, { nullable: true })
  organizationPreferences?: OrganizationPreferencesInput;

  @Field(() => EditorPreferencesInput, { nullable: true })
  editorPreferences?: EditorPreferencesInput;

  @Field(() => UIPreferencesInput, { nullable: true })
  uiPreferences?: UIPreferencesInput;
}

// GraphQL Types
@ObjectType()
export class AnalysisPreferences {
  @Field()
  autoAnalyze: boolean;

  @Field()
  confidenceThreshold: number;

  @Field(() => [String], { nullable: true })
  preferredGenres?: string[];

  @Field()
  skipLowConfidence: boolean;
}

@ObjectType()
export class OrganizationPreferences {
  @Field()
  autoOrganize: boolean;

  @Field()
  organizationMethod: string;

  @Field()
  createPlaylists: boolean;

  @Field()
  exportToDJSoftware: boolean;
}

@ObjectType()
export class EditorPreferences {
  @Field()
  showConfidenceScores: boolean;

  @Field()
  batchMode: boolean;

  @Field()
  autoSave: boolean;

  @Field()
  undoLevels: number;
}

@ObjectType()
export class UIPreferences {
  @Field()
  theme: string;

  @Field()
  language: string;

  @Field()
  defaultView: string;
}

@ObjectType()
export class UserPreferencesGraphQL {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => AnalysisPreferences)
  analysisPreferences: AnalysisPreferences;

  @Field(() => OrganizationPreferences)
  organizationPreferences: OrganizationPreferences;

  @Field(() => EditorPreferences)
  editorPreferences: EditorPreferences;

  @Field(() => UIPreferences)
  uiPreferences: UIPreferences;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@Resolver(() => UserPreferencesGraphQL)
export class UserPreferencesResolver {
  // For now, we'll use a simple in-memory approach
  // In a real implementation, you'd use a service
  private defaultPreferences: UserPreferencesGraphQL = {
    id: 'default',
    userId: null,
    analysisPreferences: {
      autoAnalyze: true,
      confidenceThreshold: 0.8,
      preferredGenres: [],
      skipLowConfidence: false,
    },
    organizationPreferences: {
      autoOrganize: false,
      organizationMethod: 'GENRE',
      createPlaylists: false,
      exportToDJSoftware: false,
    },
    editorPreferences: {
      showConfidenceScores: true,
      batchMode: false,
      autoSave: true,
      undoLevels: 10,
    },
    uiPreferences: {
      theme: 'system',
      language: 'en',
      defaultView: 'GRID',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  @Query(() => UserPreferencesGraphQL)
  async preferences(): Promise<UserPreferencesGraphQL> {
    return this.defaultPreferences;
  }

  @Mutation(() => UserPreferencesGraphQL)
  async updatePreferences(
    @Args('input') input: UpdatePreferencesInput,
  ): Promise<UserPreferencesGraphQL> {
    // Update the preferences
    if (input.analysisPreferences) {
      this.defaultPreferences.analysisPreferences = {
        ...this.defaultPreferences.analysisPreferences,
        ...input.analysisPreferences,
      };
    }

    if (input.organizationPreferences) {
      this.defaultPreferences.organizationPreferences = {
        ...this.defaultPreferences.organizationPreferences,
        ...input.organizationPreferences,
      };
    }

    if (input.editorPreferences) {
      this.defaultPreferences.editorPreferences = {
        ...this.defaultPreferences.editorPreferences,
        ...input.editorPreferences,
      };
    }

    if (input.uiPreferences) {
      this.defaultPreferences.uiPreferences = {
        ...this.defaultPreferences.uiPreferences,
        ...input.uiPreferences,
      };
    }

    this.defaultPreferences.updatedAt = new Date();

    return this.defaultPreferences;
  }
}
