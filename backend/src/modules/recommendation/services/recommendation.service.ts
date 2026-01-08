import { Injectable, Logger } from '@nestjs/common';
import { MusicTrackWithRelations } from 'src/models';
import { ElasticsearchMusicTrackDocument } from 'src/models/music-track.model';
import { AggregationStatistics } from 'src/modules/ai-integration/ai-service-simple.types';
import { SimpleMusicTrack } from 'src/modules/music-track/music-track.model';
import { ElasticsearchService } from '../../../shared/services/elasticsearch.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import {
  AudioFeatures,
  PlaylistRecommendationDto,
  RecommendationCriteria,
  RecommendationWeights,
  TrackSimilarity,
} from '../interfaces/recommendation.interface';

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  // Priority order: Genre > Subgenre > Atmosphere > Tempo > AudioSimilarity
  // Effective weights (with boosts): Subgenre (4.0) > Genre (3.0) > Atmosphere (1.4) > Tempo (0.5) > AudioSimilarity (0.48)
  genreSimilarity: 1.0, // Genre/subgenre matching - highest priority (boost: 3.0x for genres, 4.0x for subgenres)
  aiMetadataSimilarity: 0.7, // Atmosphere matching - second priority (boost: 2.0x for atmosphere = 1.4 effective)
  audioFeatures: 2.0, // Tempo matching - third priority (tempo weight: 0.25x of this = 0.5 effective)
  audioSimilarity: 0.3, // MFCC/Chroma vector similarity - fourth priority (boost: 1.6x for MFCC = 0.48 effective)
  metadataSimilarity: 0.2, // Artist/album similarity - lower priority
  userBehavior: 0.1, // Listening history/favorites - lowest priority
};

export const ZERO_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  audioSimilarity: 0,
  genreSimilarity: 0,
  metadataSimilarity: 0,
  userBehavior: 0,
  audioFeatures: 0,
  aiMetadataSimilarity: 0,
};

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async getPlaylistRecommendations(
    dto: PlaylistRecommendationDto,
    criteria?: RecommendationCriteria,
  ): Promise<TrackSimilarity[]> {
    const { playlistId, limit = 20, excludeTrackIds = [] } = dto;
    const recommendationCriteria = criteria || {
      weights: DEFAULT_RECOMMENDATION_WEIGHTS,
      limit,
      excludeTrackIds,
    };

    try {
      // Get playlist tracks with their audio features
      const playlistTracks = await this.prisma.playlistTrack.findMany({
        where: { playlistId },
        include: {
          track: {
            include: {
              audioFingerprint: true,
              aiAnalysisResult: true,
              imageSearches: true,
              library: true,
              trackGenres: {
                include: {
                  genre: true,
                },
              },
              trackSubgenres: {
                include: {
                  subgenre: true,
                },
              },
            },
          },
        },
      });

      if (playlistTracks.length === 0) {
        return [];
      }

      // Use Elasticsearch for advanced recommendations
      return await this.getRecommendations(
        playlistTracks,
        recommendationCriteria,
      );
    } catch (error) {
      this.logger.error('Error getting playlist recommendations:', error);
    }
  }

  async getRecommendations(
    playlistTracks: { track: MusicTrackWithRelations }[],
    criteria: RecommendationCriteria,
  ): Promise<TrackSimilarity[]> {
    const playlistFeatures = this.calculatePlaylistFeatures(playlistTracks);
    const excludeTrackIds = [
      ...playlistTracks.map((pt) => pt.track.id),
      ...(criteria.excludeTrackIds || []),
    ];
    // Build Elasticsearch query with multi-criteria scoring
    const query = this.buildElasticsearchRecommendationQuery(
      playlistFeatures,
      criteria,
      excludeTrackIds,
    );

    try {
      const response = await this.elasticsearchService.searchTracks(query);
      const hits = response.hits.hits;

      // Let Elasticsearch handle scoring - no normalization needed
      return hits.map((hit: any) => {
        return {
          track: this.mapElasticsearchHitToTrack(hit._source),
          similarity: hit._score, // Use raw Elasticsearch score directly
          reasons: this.extractReasonsFromElasticsearch(hit, playlistFeatures),
        };
      });
    } catch (error) {
      this.logger.error('Elasticsearch recommendation error:', error);
      throw error;
    }
  }

  private buildElasticsearchRecommendationQuery(
    playlistFeatures: AudioFeatures,
    criteria: RecommendationCriteria,
    excludeTrackIds: string[],
  ) {
    const { weights } = criteria;

    const shouldMfcc =
      weights.audioSimilarity > 0 &&
      playlistFeatures.mfcc &&
      playlistFeatures.mfcc.length > 0
        ? {
            knn: {
              field: 'audio_fingerprint.mfcc',
              query_vector: playlistFeatures.mfcc,
              k: Math.min(criteria.limit || 20, 50),
              num_candidates: Math.min((criteria.limit || 20) * 10, 1000),
              boost: weights.audioSimilarity * 1.6,
            },
          }
        : null;
    const shouldChroma =
      weights.audioSimilarity > 0 &&
      playlistFeatures.chromaMean &&
      playlistFeatures.chromaMean.length === 12
        ? {
            knn: {
              field: 'audio_fingerprint.chroma.mean',
              query_vector: playlistFeatures.chromaMean,
              k: Math.min(criteria.limit || 20, 50),
              num_candidates: Math.min((criteria.limit || 20) * 10, 1000),
              boost: weights.audioSimilarity * 1.5,
            },
          }
        : null;

    const shouldTonnetz =
      weights.audioSimilarity > 0 &&
      playlistFeatures.tonnetzMean &&
      playlistFeatures.tonnetzMean.length === 6
        ? {
            knn: {
              field: 'audio_fingerprint.tonnetz.mean',
              query_vector: playlistFeatures.tonnetzMean,
              k: Math.min(criteria.limit || 20, 50),
              num_candidates: Math.min((criteria.limit || 20) * 10, 1000),
              boost: weights.audioSimilarity * 1.3,
            },
          }
        : null;
    const shouldGenre =
      weights.genreSimilarity > 0 &&
      playlistFeatures.genres &&
      playlistFeatures.genres.length > 0
        ? {
            bool: {
              should: [
                {
                  terms: {
                    genres: playlistFeatures.genres,
                    boost: Math.max(weights.genreSimilarity * 3.0, 1.0),
                  },
                },
                ...(playlistFeatures.subgenres &&
                playlistFeatures.subgenres.length > 0
                  ? [
                      {
                        terms: {
                          subgenres: playlistFeatures.subgenres,
                          boost: Math.max(weights.genreSimilarity * 4.0, 1),
                        },
                      },
                    ]
                  : []),
              ],
              minimum_should_match: 1,
            },
          }
        : null;
    const shouldCamelotKey =
      weights.audioFeatures > 0 && playlistFeatures.camelotKey
        ? {
            term: {
              'audio_fingerprint.camelot_key': {
                value: playlistFeatures.camelotKey,
                boost: Math.max(weights.audioFeatures * 2.5, 1.0), // High boost for harmonic key matching
              },
            },
          }
        : null;

    const shouldEnergyKeywords =
      weights.audioFeatures > 0 &&
      playlistFeatures.energyKeywords &&
      playlistFeatures.energyKeywords.length > 0
        ? {
            terms: {
              'audio_fingerprint.energy_keywords':
                playlistFeatures.energyKeywords,
              boost: Math.max(weights.audioFeatures * 1.5, 0.5),
            },
          }
        : null;

    const shouldTempo =
      weights.audioFeatures > 0 && playlistFeatures.tempo
        ? {
            function_score: {
              query: { match_all: {} },
              functions: [
                {
                  gauss: {
                    'audio_fingerprint.tempo': {
                      origin: playlistFeatures.tempo || 120,
                      scale: 15,
                      decay: 0.3,
                      offset: 5,
                    },
                  },
                },
              ],
            },
          }
        : null;

    const shouldAudioFeatures =
      weights.audioFeatures > 0
        ? {
            function_score: {
              query: { match_all: {} },
              functions: [
                // Core rhythmic features (highest priority)
                {
                  gauss: {
                    'audio_fingerprint.energy_factor': {
                      origin: playlistFeatures.energy || 0.5,
                      scale: 0.15,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.2, 0.4),
                },
                {
                  gauss: {
                    'audio_fingerprint.danceability': {
                      origin: playlistFeatures.danceability || 0.5,
                      scale: 0.15,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.2, 0.4),
                },
                // Emotional features (2D emotional space)
                {
                  gauss: {
                    'audio_fingerprint.valence': {
                      origin: playlistFeatures.valence || 0.5,
                      scale: 0.15,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.2, 0.4),
                },
                {
                  gauss: {
                    'audio_fingerprint.arousal': {
                      origin: playlistFeatures.arousal || 0.5,
                      scale: 0.15,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.2, 0.4),
                },
                // Rhythm coherence features
                {
                  gauss: {
                    'audio_fingerprint.rhythm_stability': {
                      origin: playlistFeatures.rhythmStability || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.15, 0.3),
                },
                {
                  gauss: {
                    'audio_fingerprint.beat_strength': {
                      origin: playlistFeatures.beatStrength || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.15, 0.3),
                },
                {
                  gauss: {
                    'audio_fingerprint.syncopation': {
                      origin: playlistFeatures.syncopation || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.1, 0.2),
                },
                {
                  gauss: {
                    'audio_fingerprint.tempo_regularity': {
                      origin: playlistFeatures.tempoRegularity || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.1, 0.2),
                },
                // Tonal characteristics
                {
                  gauss: {
                    'audio_fingerprint.bass_presence': {
                      origin: playlistFeatures.bassPresence || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.15, 0.3),
                },
                {
                  gauss: {
                    'audio_fingerprint.brightness_factor': {
                      origin: playlistFeatures.brightnessFactor || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.1, 0.2),
                },
                {
                  gauss: {
                    'audio_fingerprint.harmonic_factor': {
                      origin: playlistFeatures.harmonicFactor || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.1, 0.2),
                },
                {
                  gauss: {
                    'audio_fingerprint.spectral_balance': {
                      origin: playlistFeatures.spectralBalance || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.08, 0.15),
                },
                // Content type features
                {
                  gauss: {
                    'audio_fingerprint.instrumentalness': {
                      origin: playlistFeatures.instrumentalness || 0.5,
                      scale: 0.25,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.15, 0.3),
                },
                {
                  gauss: {
                    'audio_fingerprint.speechiness': {
                      origin: playlistFeatures.speechiness || 0.1,
                      scale: 0.15,
                      decay: 0.5,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.12, 0.25),
                },
                {
                  gauss: {
                    'audio_fingerprint.acousticness': {
                      origin: playlistFeatures.acousticness || 0.5,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.1, 0.2),
                },
                {
                  gauss: {
                    'audio_fingerprint.liveness': {
                      origin: playlistFeatures.liveness || 0.2,
                      scale: 0.2,
                      decay: 0.3,
                      offset: 0.05,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.08, 0.15),
                },
                // Musical mode (major/minor)
                {
                  gauss: {
                    'audio_fingerprint.mode_factor': {
                      origin: playlistFeatures.modeFactor || 0.5,
                      scale: 0.3,
                      decay: 0.3,
                      offset: 0.1,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.12, 0.25),
                },
                // Spectral features (lower priority)
                {
                  gauss: {
                    'audio_fingerprint.spectral_centroid.mean': {
                      origin: playlistFeatures.spectralCentroid || 2000,
                      scale: 500,
                      decay: 0.3,
                      offset: 100,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.05, 0.1),
                },
                {
                  gauss: {
                    'audio_fingerprint.spectral_rolloff.mean': {
                      origin: playlistFeatures.spectralRolloff || 3000,
                      scale: 800,
                      decay: 0.3,
                      offset: 200,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.03, 0.05),
                },
                {
                  gauss: {
                    'audio_fingerprint.zero_crossing_rate.mean': {
                      origin: playlistFeatures.zeroCrossingRate || 0.1,
                      scale: 0.05,
                      decay: 0.3,
                      offset: 0.01,
                    },
                  },
                  weight: Math.max(weights.audioFeatures * 0.03, 0.05),
                },
              ],
              score_mode: 'sum',
              boost_mode: 'multiply',
            },
          }
        : null;

    const shouldMetadataSimilarity =
      weights.metadataSimilarity > 0
        ? {
            multi_match: {
              query: playlistFeatures.artist || '',
              fields: ['artist^3', 'album^2'], // Increased artist boost
              type: 'best_fields',
              fuzziness: 'AUTO',
              boost: Math.max(weights.metadataSimilarity * 2.0, 0.8),
              minimum_should_match: '75%',
            },
          }
        : null;

    // AI metadata similarity queries
    const shouldAiTags =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.aiTags &&
      playlistFeatures.aiTags.length > 0
        ? {
            terms: {
              ai_tags: playlistFeatures.aiTags,
              boost: Math.max(weights.aiMetadataSimilarity * 2.5, 1.0),
            },
          }
        : null;

    const shouldAtmosphereKeywords =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.atmosphereKeywords &&
      playlistFeatures.atmosphereKeywords.length > 0
        ? {
            terms: {
              atmosphere_desc: playlistFeatures.atmosphereKeywords,
              boost: Math.max(weights.aiMetadataSimilarity * 4.0, 4.0),
            },
          }
        : null;

    const shouldAiDescription =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.aiDescriptions &&
      playlistFeatures.aiDescriptions.length > 0
        ? {
            bool: {
              should: playlistFeatures.aiDescriptions.map((description) => ({
                match: {
                  ai_description: {
                    query: description,
                    boost: Math.max(weights.aiMetadataSimilarity * 1.5, 0.8),
                    fuzziness: 'AUTO',
                    minimum_should_match: '50%',
                  },
                },
              })),
              minimum_should_match: 1,
            },
          }
        : null;

    const shouldVocalsDesc =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.vocalsDescriptions &&
      playlistFeatures.vocalsDescriptions.trim().length > 0
        ? {
            match: {
              vocals_desc: {
                query: playlistFeatures.vocalsDescriptions,
                boost: Math.max(weights.aiMetadataSimilarity * 1.8, 0.9),
                fuzziness: 'AUTO',
                minimum_should_match: '60%',
              },
            },
          }
        : null;

    const shouldContextBackground =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.contextBackgrounds &&
      playlistFeatures.contextBackgrounds.trim().length > 0
        ? {
            match: {
              context_background: {
                query: playlistFeatures.contextBackgrounds,
                boost: Math.max(weights.aiMetadataSimilarity * 1.6, 0.8),
                fuzziness: 'AUTO',
                minimum_should_match: '50%',
              },
            },
          }
        : null;

    const shouldContextImpact =
      weights.aiMetadataSimilarity > 0 &&
      playlistFeatures.contextImpacts &&
      playlistFeatures.contextImpacts.trim().length > 0
        ? {
            match: {
              context_impact: {
                query: playlistFeatures.contextImpacts,
                boost: Math.max(weights.aiMetadataSimilarity * 1.6, 0.8),
                fuzziness: 'AUTO',
                minimum_should_match: '50%',
              },
            },
          }
        : null;
    const should = [
      // k-NN search for MFCC similarity (timbre)
      shouldMfcc,

      // k-NN search for chroma similarity (pitch content)
      shouldChroma,

      // k-NN search for tonnetz similarity (harmonic progression)
      //shouldTonnetz,

      // Genre similarity with better scoring
      shouldGenre,

      // Camelot key matching for harmonic mixing
      //shouldCamelotKey,

      // Energy keywords matching
      // shouldEnergyKeywords,

      // Audio features similarity with improved scoring
      //shouldAudioFeatures,
      shouldTempo,
      // User behavior scoring with improved weights
      /*   {
              function_score: {
                query: { match_all: {} },
                functions: [
                  {
                    field_value_factor: {
                      field: 'listening_count',
                      factor: 0.2, // Increased factor
                      modifier: 'log1p',
                      missing: 1, // Default value for missing fields
                    },
                    weight: Math.max(weights.userBehavior * 0.6, 0.3),
                  },
                  {
                    filter: { term: { is_favorite: true } },
                    weight: Math.max(weights.userBehavior * 0.4, 0.5),
                  },
                ],
                score_mode: 'sum',
                boost_mode: 'multiply',
              },
            }, */

      // Metadata similarity with improved scoring
      //shouldMetadataSimilarity,

      // AI metadata similarity
      shouldAiTags,
      shouldAtmosphereKeywords,
      shouldAiDescription,
      shouldVocalsDesc,
      shouldContextBackground,
      shouldContextImpact,
    ]?.filter((s) => s !== null);
    return {
      size: criteria.limit || 20,
      query: {
        bool: {
          must_not: [{ terms: { id: excludeTrackIds } }],
          should,
          // Control scoring behavior to prevent scores exceeding calculated maximum
          minimum_should_match: 1,
        },
      },
      highlight: {
        fields: {
          genres: {},
          subgenres: {},
          ai_tags: {},
          atmosphere_desc: {},
          ai_description: { number_of_fragments: 1, fragment_size: 100 },
          vocals_desc: { number_of_fragments: 1, fragment_size: 100 },
          context_background: { number_of_fragments: 1, fragment_size: 100 },
          context_impact: { number_of_fragments: 1, fragment_size: 100 },
          'audio_fingerprint.energy_keywords': {},
        },
        require_field_match: false,
      },
      _source: {
        includes: [
          'id',
          'title',
          'artist',
          'album',
          'duration',
          'genres',
          'subgenres',
          'ai_tags',
          'atmosphere_desc',
          'ai_description',
          'vocals_desc',
          'context_background',
          'context_impact',
          'audio_fingerprint',
          'is_favorite',
          'listening_count',
          'last_played_at',
          'created_at',
          'updated_at',
          'original_date',
          'image_path',
        ],
      },
    };
  }

  /**
   * Test genre-only scoring to verify expected behavior
   */
  async testGenreScoring(playlistId: string): Promise<any> {
    const playlistTracks = await this.prisma.playlistTrack.findMany({
      where: { playlistId },
      include: {
        track: {
          include: {
            audioFingerprint: true,
            aiAnalysisResult: true,
            imageSearches: true,
            library: true,
            trackGenres: {
              include: {
                genre: true,
              },
            },
            trackSubgenres: {
              include: {
                subgenre: true,
              },
            },
          },
        },
      },
    });

    if (playlistTracks.length === 0) {
      return { message: 'No tracks found in playlist' };
    }

    const playlistFeatures = this.calculatePlaylistFeatures(playlistTracks);
    const excludeTrackIds = playlistTracks.map((pt) => pt.trackId);

    // Genre-only query (your current simplified setup)
    const genreOnlyQuery = {
      size: 20,
      query: {
        bool: {
          must_not: [{ terms: { id: excludeTrackIds } }],
          should: [
            ...(playlistFeatures.genres && playlistFeatures.genres.length > 0
              ? [
                  {
                    terms: {
                      genres: playlistFeatures.genres,
                      boost: 3.0, // weights.genreSimilarity * 3.0 = 1 * 3.0
                    },
                  },
                ]
              : []),
            ...(playlistFeatures.subgenres &&
            playlistFeatures.subgenres.length > 0
              ? [
                  {
                    terms: {
                      subgenres: playlistFeatures.subgenres,
                      boost: 2.0, // weights.genreSimilarity * 2.0 = 1 * 2.0
                    },
                  },
                ]
              : []),
          ],
          minimum_should_match: 1,
        },
      },
    };

    try {
      const response =
        await this.elasticsearchService.searchTracks(genreOnlyQuery);
      const hits = response.hits.hits;

      // Calculate max possible score for your current weights
      const weights = {
        genreSimilarity: 1,
        audioSimilarity: 0,
        audioFeatures: 0,
        userBehavior: 0,
        metadataSimilarity: 0,
        aiMetadataSimilarity: 0,
      };
      return {
        playlistFeatures: {
          genres: playlistFeatures.genres || [],
          subgenres: playlistFeatures.subgenres || [],
        },
        results: hits.map((hit: any) => {
          const trackGenres = hit._source.genres || [];
          const trackSubgenres = hit._source.subgenres || [];
          const playlistGenres = playlistFeatures.genres || [];
          const playlistSubgenres = playlistFeatures.subgenres || [];

          const genreMatch =
            playlistGenres.length > 0 &&
            trackGenres.some((g: string) => playlistGenres.includes(g));
          const subgenreMatch =
            playlistSubgenres.length > 0 &&
            trackSubgenres.some((s: string) => playlistSubgenres.includes(s));

          return {
            id: hit._source.id,
            title: hit._source.title,
            artist: hit._source.artist,
            genres: trackGenres,
            subgenres: trackSubgenres,
            score: hit._score, // Raw Elasticsearch score
            matches: {
              genre: genreMatch,
              subgenre: subgenreMatch,
              both: genreMatch && subgenreMatch,
            },
          };
        }),
        note: 'Scores are raw Elasticsearch values - higher scores indicate better matches',
      };
    } catch (error) {
      this.logger.error('Error testing genre scoring:', error);
      throw error;
    }
  }

  /**
   * Debug method to analyze recommendation scores
   */
  async debugRecommendationScores(
    playlistId: string,
    criteria: RecommendationCriteria,
  ): Promise<any> {
    // Get playlist tracks with their audio features
    const playlistTracks = await this.prisma.playlistTrack.findMany({
      where: { playlistId },
      include: {
        track: {
          include: {
            audioFingerprint: true,
            aiAnalysisResult: true,
            imageSearches: true,
            library: true,
            trackGenres: {
              include: {
                genre: true,
              },
            },
            trackSubgenres: {
              include: {
                subgenre: true,
              },
            },
          },
        },
      },
    });

    if (playlistTracks.length === 0) {
      return { message: 'No tracks found in playlist' };
    }

    const playlistFeatures = this.calculatePlaylistFeatures(playlistTracks);
    const excludeTrackIds = [
      ...playlistTracks.map((pt) => pt.trackId),
      ...(criteria.excludeTrackIds || []),
    ];

    const query = this.buildElasticsearchRecommendationQuery(
      playlistFeatures,
      criteria,
      excludeTrackIds,
    );

    // Add explain parameter to get detailed scoring information
    (query as any).explain = true;
    query.size = 5; // Limit to 5 results for debugging

    try {
      const response = await this.elasticsearchService.searchTracks(query);
      const hits = response.hits.hits;
      return {
        playlistFeatures,
        query,
        results: hits.map((hit: any) => ({
          track: {
            id: hit._source.id,
            title: hit._source.title,
            artist: hit._source.artist,
            genres: hit._source.genres || [],
            subgenres: hit._source.subgenres || [],
          },
          score: hit._score,
          explanation: hit._explanation,
        })),
      };
    } catch (error) {
      this.logger.error('Debug recommendation error:', error);
      throw error;
    }
  }

  private mapElasticsearchHitToTrack(
    source: ElasticsearchMusicTrackDocument,
  ): SimpleMusicTrack {
    // Map Elasticsearch document back to MusicTrack format
    // Ensure duration is always a number (required non-nullable field)
    const duration = source.duration ?? 0;

    const track = {
      id: source.id,
      title: source.title || '',
      artist: source.artist || '',
      genres: source.genres || [],
      subgenres: source.subgenres || [],
      duration: duration,
      listeningCount: source.listening_count || 0,
      lastPlayedAt: source.last_played_at
        ? new Date(source.last_played_at)
        : undefined,
      isFavorite: source.is_favorite ?? false,
      isLiked: source.is_liked ?? false,
      isBanger: source.is_banger ?? false,
      createdAt: source.created_at ? new Date(source.created_at) : undefined,
      updatedAt: source.updated_at ? new Date(source.updated_at) : undefined,
      tempo: source.audio_fingerprint?.tempo,
      key: source.audio_fingerprint?.key,
      energy: source.audio_fingerprint?.energy_factor,
      valence: source.audio_fingerprint?.valence,
      danceability: source.audio_fingerprint?.danceability,
      acousticness: source.audio_fingerprint?.acousticness,
      instrumentalness: source.audio_fingerprint?.instrumentalness,
      speechiness: source.audio_fingerprint?.speechiness,
      imagePath: source.image_path,
      date: source.original_date ? new Date(source.original_date) : undefined,
      description: source.ai_description,
      tags: source.ai_tags,
      vocalsDescriptions: source.vocals_desc,
      atmosphereKeywords: source.atmosphere_desc,
      contextBackgrounds: source.context_background,
      contextImpacts: source.context_impact,
    } as SimpleMusicTrack;
    return track;
  }

  /**
   * Extract recommendation reasons directly from Elasticsearch highlights and matched fields
   */
  private extractReasonsFromElasticsearch(
    hit: any,
    playlistFeatures: AudioFeatures,
  ): string[] {
    const reasons: string[] = [];
    const trackSource = hit._source;
    const highlights = hit.highlight || {};

    // Extract reasons from Elasticsearch highlights
    if (highlights.genres && highlights.genres.length > 0) {
      const matchedGenres = highlights.genres
        .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
        .filter((g: string) => trackSource.genres?.includes(g));
      if (matchedGenres.length > 0) {
        reasons.push(
          `Same genre${matchedGenres.length > 1 ? 's' : ''}: ${matchedGenres.slice(0, 3).join(', ')}`,
        );
      }
    }

    if (highlights.subgenres && highlights.subgenres.length > 0) {
      const matchedSubgenres = highlights.subgenres
        .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
        .filter((s: string) => trackSource.subgenres?.includes(s));
      if (matchedSubgenres.length > 0) {
        reasons.push(
          `Same subgenre${matchedSubgenres.length > 1 ? 's' : ''}: ${matchedSubgenres.slice(0, 3).join(', ')}`,
        );
      }
    }

    if (highlights.ai_tags && highlights.ai_tags.length > 0) {
      const matchedTags = highlights.ai_tags
        .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
        .filter((tag: string) => trackSource.ai_tags?.includes(tag));
      if (matchedTags.length > 0) {
        reasons.push(`Similar tags: ${matchedTags.slice(0, 3).join(', ')}`);
      }
    }

    if (highlights.atmosphere_desc && highlights.atmosphere_desc.length > 0) {
      const matchedAtmosphere = highlights.atmosphere_desc
        .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
        .filter((keyword: string) =>
          trackSource.atmosphere_desc?.includes(keyword),
        );
      if (matchedAtmosphere.length > 0) {
        reasons.push(
          `Similar atmosphere: ${matchedAtmosphere.slice(0, 2).join(', ')}`,
        );
      }
    }

    if (highlights.ai_description && highlights.ai_description.length > 0) {
      reasons.push('Similar AI description');
    }

    if (highlights.vocals_desc && highlights.vocals_desc.length > 0) {
      reasons.push('Similar vocal characteristics');
    }

    if (
      highlights.context_background &&
      highlights.context_background.length > 0
    ) {
      reasons.push('Similar context background');
    }

    if (highlights.context_impact && highlights.context_impact.length > 0) {
      reasons.push('Similar context impact');
    }

    if (
      highlights['audio_fingerprint.energy_keywords'] &&
      highlights['audio_fingerprint.energy_keywords'].length > 0
    ) {
      const matchedKeywords = highlights['audio_fingerprint.energy_keywords']
        .map((h: string) => h.replace(/<em>|<\/em>/g, ''))
        .filter((keyword: string) =>
          trackSource.audio_fingerprint?.energy_keywords?.includes(keyword),
        );
      if (matchedKeywords.length > 0) {
        reasons.push(
          `Similar energy: ${matchedKeywords.slice(0, 2).join(', ')}`,
        );
      }
    }

    // Add audio feature reasons that can't be highlighted (tempo, key, energy, etc.)
    // These come from function_score and k-NN queries which don't support highlighting
    const audioFeatureReasons = this.generateAudioFeatureReasons(
      trackSource,
      playlistFeatures,
    );
    audioFeatureReasons.forEach((reason) => {
      // Avoid duplicates
      if (!reasons.some((r) => r === reason)) {
        reasons.push(reason);
      }
    });

    // If no reasons found at all, fallback to full reason generation
    if (reasons.length === 0) {
      return this.generateRecommendationReasons(trackSource, playlistFeatures);
    }

    return reasons;
  }

  /**
   * Generate reasons for audio features that can't be highlighted
   * (k-NN queries, function_score queries, etc.)
   */
  private generateAudioFeatureReasons(
    trackSource: ElasticsearchMusicTrackDocument,
    playlistFeatures: AudioFeatures,
  ): string[] {
    const reasons: string[] = [];

    // Camelot key matching (harmonic mixing)
    if (
      trackSource.audio_fingerprint?.camelot_key &&
      playlistFeatures.camelotKey &&
      trackSource.audio_fingerprint.camelot_key === playlistFeatures.camelotKey
    ) {
      reasons.push(
        `Harmonic key match: ${trackSource.audio_fingerprint.camelot_key}`,
      );
    }

    // Audio feature reasons
    if (trackSource.audio_fingerprint?.tempo && playlistFeatures.tempo) {
      const tempoDiff = Math.abs(
        trackSource.audio_fingerprint.tempo - playlistFeatures.tempo,
      );
      if (tempoDiff <= 10) {
        reasons.push(
          `Similar tempo: ${trackSource.audio_fingerprint.tempo} BPM`,
        );
      }
    }

    if (
      trackSource.audio_fingerprint?.energy_factor &&
      playlistFeatures.energy
    ) {
      const energyDiff = Math.abs(
        trackSource.audio_fingerprint.energy_factor - playlistFeatures.energy,
      );
      if (energyDiff <= 0.1) {
        reasons.push('Similar energy level');
      }
    }

    // Emotional features
    if (
      trackSource.audio_fingerprint?.valence !== undefined &&
      playlistFeatures.valence !== undefined
    ) {
      const valenceDiff = Math.abs(
        trackSource.audio_fingerprint.valence - playlistFeatures.valence,
      );
      if (valenceDiff <= 0.1) {
        reasons.push(
          `Similar mood: ${trackSource.audio_fingerprint.valence_mood || 'matching valence'}`,
        );
      }
    }

    if (
      trackSource.audio_fingerprint?.arousal !== undefined &&
      playlistFeatures.arousal !== undefined
    ) {
      const arousalDiff = Math.abs(
        trackSource.audio_fingerprint.arousal - playlistFeatures.arousal,
      );
      if (arousalDiff <= 0.1) {
        reasons.push(
          `Similar intensity: ${trackSource.audio_fingerprint.arousal_mood || 'matching arousal'}`,
        );
      }
    }

    // Danceability
    if (
      trackSource.audio_fingerprint?.danceability !== undefined &&
      playlistFeatures.danceability !== undefined
    ) {
      const danceabilityDiff = Math.abs(
        trackSource.audio_fingerprint.danceability -
          playlistFeatures.danceability,
      );
      if (danceabilityDiff <= 0.1) {
        reasons.push(
          `Similar danceability: ${trackSource.audio_fingerprint.danceability_feeling || 'matching groove'}`,
        );
      }
    }

    // Rhythmic coherence
    if (
      trackSource.audio_fingerprint?.rhythm_stability !== undefined &&
      playlistFeatures.rhythmStability !== undefined
    ) {
      const rhythmDiff = Math.abs(
        trackSource.audio_fingerprint.rhythm_stability -
          playlistFeatures.rhythmStability,
      );
      if (rhythmDiff <= 0.1) {
        reasons.push('Similar rhythm pattern');
      }
    }

    // Harmonic progression similarity (tonnetz k-NN)
    if (
      trackSource.audio_fingerprint?.tonnetz?.overall_mean !== undefined &&
      playlistFeatures.tonnetzOverallMean !== undefined
    ) {
      const tonnetzDiff = Math.abs(
        trackSource.audio_fingerprint.tonnetz.overall_mean -
          playlistFeatures.tonnetzOverallMean,
      );
      if (tonnetzDiff <= 0.15) {
        reasons.push('Similar harmonic progression');
      }
    }

    // Chroma (pitch content) similarity
    if (
      trackSource.audio_fingerprint?.chroma?.dominant_pitch !== undefined &&
      playlistFeatures.chromaDominantPitch !== undefined
    ) {
      const pitchDiff = Math.abs(
        trackSource.audio_fingerprint.chroma.dominant_pitch -
          playlistFeatures.chromaDominantPitch,
      );
      if (pitchDiff <= 2) {
        reasons.push(
          `Similar pitch content (${trackSource.audio_fingerprint.chroma.dominant_pitch})`,
        );
      }
    }

    // User behavior reasons
    if (trackSource.is_favorite) {
      reasons.push('User favorite');
    }
    if (trackSource.listening_count > 5) {
      reasons.push('Frequently played');
    }

    return reasons;
  }

  private generateRecommendationReasons(
    trackSource: ElasticsearchMusicTrackDocument,
    playlistFeatures: AudioFeatures,
  ): string[] {
    const reasons: string[] = [];

    // Genre reasons (fallback if not in highlights)
    if (
      playlistFeatures.genres &&
      playlistFeatures.genres.length > 0 &&
      trackSource.genres &&
      trackSource.genres.length > 0
    ) {
      const matchingGenres = playlistFeatures.genres.filter((g) =>
        trackSource.genres.includes(g),
      );
      if (matchingGenres.length > 0) {
        reasons.push(
          `Same genre${matchingGenres.length > 1 ? 's' : ''}: ${matchingGenres.join(', ')}`,
        );
      }
    }
    if (
      playlistFeatures.subgenres &&
      playlistFeatures.subgenres.length > 0 &&
      trackSource.subgenres &&
      trackSource.subgenres.length > 0
    ) {
      const matchingSubgenres = playlistFeatures.subgenres.filter((s) =>
        trackSource.subgenres.includes(s),
      );
      if (matchingSubgenres.length > 0) {
        reasons.push(
          `Same subgenre${matchingSubgenres.length > 1 ? 's' : ''}: ${matchingSubgenres.join(', ')}`,
        );
      }
    }

    // Energy keywords matching (fallback if not in highlights)
    if (
      trackSource.audio_fingerprint?.energy_keywords &&
      playlistFeatures.energyKeywords
    ) {
      const trackKeywords = Array.isArray(
        trackSource.audio_fingerprint.energy_keywords,
      )
        ? trackSource.audio_fingerprint.energy_keywords
        : [];
      const commonKeywords = trackKeywords.filter((keyword) =>
        playlistFeatures.energyKeywords?.includes(keyword),
      );
      if (commonKeywords.length > 0) {
        reasons.push(
          `Similar energy: ${commonKeywords.slice(0, 2).join(', ')}`,
        );
      }
    }

    // AI metadata reasons
    if (
      trackSource.ai_tags &&
      Array.isArray(trackSource.ai_tags) &&
      playlistFeatures.aiTags &&
      playlistFeatures.aiTags.length > 0
    ) {
      const commonTags = trackSource.ai_tags.filter((tag) =>
        playlistFeatures.aiTags?.includes(tag),
      );
      if (commonTags.length > 0) {
        reasons.push(`Similar tags: ${commonTags.slice(0, 3).join(', ')}`);
      }
    }

    if (
      trackSource.atmosphere_desc &&
      Array.isArray(trackSource.atmosphere_desc) &&
      playlistFeatures.atmosphereKeywords &&
      playlistFeatures.atmosphereKeywords.length > 0
    ) {
      const commonAtmosphere = trackSource.atmosphere_desc.filter((keyword) =>
        playlistFeatures.atmosphereKeywords?.includes(keyword),
      );
      if (commonAtmosphere.length > 0) {
        reasons.push(
          `Similar atmosphere: ${commonAtmosphere.slice(0, 2).join(', ')}`,
        );
      }
    }

    if (trackSource.vocals_desc && playlistFeatures.vocalsDescriptions) {
      const matchingVocals =
        trackSource.vocals_desc &&
        (trackSource.vocals_desc
          .toLowerCase()
          .includes(playlistFeatures.vocalsDescriptions.toLowerCase()) ||
          playlistFeatures.vocalsDescriptions
            .toLowerCase()
            .includes(trackSource.vocals_desc.toLowerCase()));
      if (matchingVocals) {
        reasons.push('Similar vocal characteristics');
      }
    }

    if (
      trackSource.ai_description &&
      playlistFeatures.aiDescriptions &&
      playlistFeatures.aiDescriptions.length > 0
    ) {
      const matchingDescription = playlistFeatures.aiDescriptions.some(
        (desc) =>
          trackSource.ai_description &&
          (trackSource.ai_description
            .toLowerCase()
            .includes(desc.toLowerCase()) ||
            desc
              .toLowerCase()
              .includes(trackSource.ai_description.toLowerCase())),
      );
      if (matchingDescription) {
        reasons.push('Similar AI description');
      }
    }

    if (trackSource.context_background && playlistFeatures.contextBackgrounds) {
      const matchingContext =
        trackSource.context_background &&
        (trackSource.context_background
          .toLowerCase()
          .includes(playlistFeatures.contextBackgrounds.toLowerCase()) ||
          playlistFeatures.contextBackgrounds
            .toLowerCase()
            .includes(trackSource.context_background.toLowerCase()));
      if (matchingContext) {
        reasons.push('Similar context background');
      }
    }

    if (trackSource.context_impact && playlistFeatures.contextImpacts) {
      const matchingImpact =
        trackSource.context_impact &&
        (trackSource.context_impact
          .toLowerCase()
          .includes(playlistFeatures.contextImpacts.toLowerCase()) ||
          playlistFeatures.contextImpacts
            .toLowerCase()
            .includes(trackSource.context_impact.toLowerCase()));
      if (matchingImpact) {
        reasons.push('Similar context impact');
      }
    }

    // User behavior reasons
    if (trackSource.is_favorite) {
      reasons.push('User favorite');
    }
    if (trackSource.listening_count > 5) {
      reasons.push('Frequently played');
    }

    return reasons;
  }

  private calculatePlaylistFeatures(
    playlistTracks: { track: MusicTrackWithRelations }[],
  ): AudioFeatures {
    const features: AudioFeatures = {
      tempo: 0,
      energy: 0,
      valence: 0,
      danceability: 0,
      arousal: 0,
      rhythmStability: 0,
      bassPresence: 0,
      tempoRegularity: 0,
      syncopation: 0,
      beatStrength: 0,
      brightnessFactor: 0,
      harmonicFactor: 0,
      spectralBalance: 0,
      modeFactor: 0,
      acousticness: 0,
      instrumentalness: 0,
      speechiness: 0,
      liveness: 0,
    };

    const genreCounts: Record<string, number> = {};
    const subgenreCounts: Record<string, number> = {};
    const keyCounts: Record<string, number> = {};
    const camelotKeyCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    const albumCounts: Record<string, number> = {};
    const valenceMoodCounts: Record<string, number> = {};
    const arousalMoodCounts: Record<string, number> = {};
    const danceabilityFeelingCounts: Record<string, number> = {};
    const allEnergyKeywords: string[] = [];

    // AI metadata collections
    const aiDescriptions: string[] = [];
    const aiTags: string[] = [];
    const vocalsDescriptions: string[] = []; // Collect all, then find most common
    const atmosphereKeywords: string[] = [];
    const contextBackgrounds: string[] = []; // Collect all, then find most common
    const contextImpacts: string[] = []; // Collect all, then find most common

    // Arrays for vector features
    const mfccArrays: number[][] = [];
    const chromaMeanArrays: number[][] = [];
    const chromaOverallMeans: number[] = [];
    const chromaDominantPitches: number[] = [];
    const tonnetzMeanArrays: number[][] = [];
    const tonnetzOverallMeans: number[] = [];
    const spectralCentroids: number[] = [];
    const spectralRolloffs: number[] = [];
    const zeroCrossingRates: number[] = [];

    let validTracks = 0;

    playlistTracks.forEach((playlistTrack) => {
      const track = playlistTrack.track;
      const fingerprint = track.audioFingerprint;

      if (fingerprint) {
        if (fingerprint.tempo) {
          features.tempo! += fingerprint.tempo;
          validTracks++;
        }
        if (
          fingerprint.energyFactor !== null &&
          fingerprint.energyFactor !== undefined
        ) {
          features.energy! += fingerprint.energyFactor;
        }
        if (fingerprint.valence !== null && fingerprint.valence !== undefined) {
          features.valence! += fingerprint.valence;
        }
        if (
          fingerprint.danceability !== null &&
          fingerprint.danceability !== undefined
        ) {
          features.danceability! += fingerprint.danceability;
        }
        if (fingerprint.arousal !== null && fingerprint.arousal !== undefined) {
          features.arousal! += fingerprint.arousal;
        }
        if (
          fingerprint.rhythmStability !== null &&
          fingerprint.rhythmStability !== undefined
        ) {
          features.rhythmStability! += fingerprint.rhythmStability;
        }
        if (
          fingerprint.bassPresence !== null &&
          fingerprint.bassPresence !== undefined
        ) {
          features.bassPresence! += fingerprint.bassPresence;
        }
        if (
          fingerprint.tempoRegularity !== null &&
          fingerprint.tempoRegularity !== undefined
        ) {
          features.tempoRegularity! += fingerprint.tempoRegularity;
        }
        if (
          fingerprint.syncopation !== null &&
          fingerprint.syncopation !== undefined
        ) {
          features.syncopation! += fingerprint.syncopation;
        }
        if (
          fingerprint.beatStrength !== null &&
          fingerprint.beatStrength !== undefined
        ) {
          features.beatStrength! += fingerprint.beatStrength;
        }
        if (
          fingerprint.brightnessFactor !== null &&
          fingerprint.brightnessFactor !== undefined
        ) {
          features.brightnessFactor! += fingerprint.brightnessFactor;
        }
        if (
          fingerprint.harmonicFactor !== null &&
          fingerprint.harmonicFactor !== undefined
        ) {
          features.harmonicFactor! += fingerprint.harmonicFactor;
        }
        if (
          fingerprint.spectralBalance !== null &&
          fingerprint.spectralBalance !== undefined
        ) {
          features.spectralBalance! += fingerprint.spectralBalance;
        }
        if (
          fingerprint.modeFactor !== null &&
          fingerprint.modeFactor !== undefined
        ) {
          features.modeFactor! += fingerprint.modeFactor;
        }
        if (
          fingerprint.acousticness !== null &&
          fingerprint.acousticness !== undefined
        ) {
          features.acousticness! += fingerprint.acousticness;
        }
        if (
          fingerprint.instrumentalness !== null &&
          fingerprint.instrumentalness !== undefined
        ) {
          features.instrumentalness! += fingerprint.instrumentalness;
        }
        if (
          fingerprint.speechiness !== null &&
          fingerprint.speechiness !== undefined
        ) {
          features.speechiness! += fingerprint.speechiness;
        }
        if (
          fingerprint.liveness !== null &&
          fingerprint.liveness !== undefined
        ) {
          features.liveness! += fingerprint.liveness;
        }
        if (fingerprint.key) {
          keyCounts[fingerprint.key] = (keyCounts[fingerprint.key] || 0) + 1;
        }
        if (fingerprint.camelotKey) {
          camelotKeyCounts[fingerprint.camelotKey] =
            (camelotKeyCounts[fingerprint.camelotKey] || 0) + 1;
        }
        if (fingerprint.valenceMood) {
          valenceMoodCounts[fingerprint.valenceMood] =
            (valenceMoodCounts[fingerprint.valenceMood] || 0) + 1;
        }
        if (fingerprint.arousalMood) {
          arousalMoodCounts[fingerprint.arousalMood] =
            (arousalMoodCounts[fingerprint.arousalMood] || 0) + 1;
        }
        if (fingerprint.danceabilityFeeling) {
          danceabilityFeelingCounts[fingerprint.danceabilityFeeling] =
            (danceabilityFeelingCounts[fingerprint.danceabilityFeeling] || 0) +
            1;
        }
        if (fingerprint.energyKeywords) {
          try {
            const keywords = JSON.parse(fingerprint.energyKeywords);
            if (Array.isArray(keywords)) {
              allEnergyKeywords.push(...keywords);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        // Collect vector features
        if (fingerprint.mfcc) {
          try {
            const mfccArray = JSON.parse(fingerprint.mfcc);
            if (Array.isArray(mfccArray)) {
              mfccArrays.push(mfccArray);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        if (fingerprint.chroma) {
          try {
            const chromaStats = JSON.parse(fingerprint.chroma);
            if (chromaStats && typeof chromaStats === 'object') {
              // Extract 12-dimensional pitch class distribution (for k-NN)
              if (
                Array.isArray(chromaStats.mean) &&
                chromaStats.mean.length === 12
              ) {
                chromaMeanArrays.push(chromaStats.mean);
              }
              // Extract scalar values for fallback/additional scoring
              if (chromaStats.overall_mean !== undefined) {
                chromaOverallMeans.push(chromaStats.overall_mean);
              }
              if (chromaStats.dominant_pitch !== undefined) {
                chromaDominantPitches.push(chromaStats.dominant_pitch);
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        if (fingerprint.spectralCentroid) {
          const spectralCentroidArray = JSON.parse(
            fingerprint.spectralCentroid,
          ) as AggregationStatistics;
          if (spectralCentroidArray?.mean) {
            spectralCentroids.push(spectralCentroidArray.mean);
          }
        }

        if (fingerprint.spectralRolloff) {
          const spectralRolloffArray = JSON.parse(
            fingerprint.spectralRolloff,
          ) as AggregationStatistics;
          if (spectralRolloffArray?.mean) {
            spectralRolloffs.push(spectralRolloffArray.mean);
          }
        }

        if (fingerprint.zeroCrossingRate) {
          const zeroCrossingRateArray = JSON.parse(
            fingerprint.zeroCrossingRate,
          ) as AggregationStatistics;
          if (zeroCrossingRateArray?.mean) {
            zeroCrossingRates.push(zeroCrossingRateArray.mean);
          }
        }

        if (fingerprint.tonnetz) {
          try {
            const tonnetzStats = JSON.parse(fingerprint.tonnetz);
            if (tonnetzStats && typeof tonnetzStats === 'object') {
              // Extract 6-dimensional tonal centroid (for k-NN)
              if (
                Array.isArray(tonnetzStats.mean) &&
                tonnetzStats.mean.length === 6
              ) {
                tonnetzMeanArrays.push(tonnetzStats.mean);
              }
              // Extract scalar value for fallback
              if (tonnetzStats.overall_mean !== undefined) {
                tonnetzOverallMeans.push(tonnetzStats.overall_mean);
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      // Count genres and subgenres
      if (track.trackGenres && track.trackGenres.length > 0) {
        for (const trackGenre of track.trackGenres) {
          const genreName = trackGenre.genre.name;
          genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
        }
      }

      if (track.trackSubgenres && track.trackSubgenres.length > 0) {
        for (const trackSubgenre of track.trackSubgenres) {
          const subgenreName = trackSubgenre.subgenre.name;
          subgenreCounts[subgenreName] =
            (subgenreCounts[subgenreName] || 0) + 1;
        }
      }

      // Count artists and albums
      const artist = track.aiArtist || track.originalArtist || track.userArtist;
      if (artist) {
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      }

      const album = track.aiAlbum || track.originalAlbum || track.userAlbum;
      if (album) {
        albumCounts[album] = (albumCounts[album] || 0) + 1;
      }

      // Collect AI metadata
      if (track.aiDescription) {
        aiDescriptions.push(track.aiDescription);
      }
      if (track.aiTags) {
        try {
          const tags = JSON.parse(track.aiTags);
          if (Array.isArray(tags)) {
            aiTags.push(...tags);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      if (track.vocalsDesc) {
        vocalsDescriptions.push(track.vocalsDesc);
      }
      if (track.atmosphereDesc) {
        try {
          const atmosphere = JSON.parse(track.atmosphereDesc);
          if (Array.isArray(atmosphere)) {
            atmosphereKeywords.push(...atmosphere);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      if (track.contextBackground) {
        contextBackgrounds.push(track.contextBackground);
      }
      if (track.contextImpact) {
        contextImpacts.push(track.contextImpact);
      }
    });

    // Calculate averages
    if (validTracks > 0) {
      features.tempo = features.tempo! / validTracks;
      features.energy = features.energy! / playlistTracks.length;
      features.valence = features.valence! / playlistTracks.length;
      features.danceability = features.danceability! / playlistTracks.length;
      features.arousal = features.arousal! / playlistTracks.length;
      features.rhythmStability =
        features.rhythmStability! / playlistTracks.length;
      features.bassPresence = features.bassPresence! / playlistTracks.length;
      features.tempoRegularity =
        features.tempoRegularity! / playlistTracks.length;
      features.syncopation = features.syncopation! / playlistTracks.length;
      features.beatStrength = features.beatStrength! / playlistTracks.length;
      features.brightnessFactor =
        features.brightnessFactor! / playlistTracks.length;
      features.harmonicFactor =
        features.harmonicFactor! / playlistTracks.length;
      features.spectralBalance =
        features.spectralBalance! / playlistTracks.length;
      features.modeFactor = features.modeFactor! / playlistTracks.length;
      features.acousticness = features.acousticness! / playlistTracks.length;
      features.instrumentalness =
        features.instrumentalness! / playlistTracks.length;
      features.speechiness = features.speechiness! / playlistTracks.length;
      features.liveness = features.liveness! / playlistTracks.length;
    }

    // Calculate average vector features
    if (mfccArrays.length > 0) {
      features.mfcc = this.calculateAverageVector(mfccArrays);
    }
    if (chromaMeanArrays.length > 0) {
      features.chromaMean = this.calculateAverageVector(chromaMeanArrays);
    }
    if (chromaOverallMeans.length > 0) {
      features.chromaOverallMean =
        chromaOverallMeans.reduce((a, b) => a + b, 0) /
        chromaOverallMeans.length;
    }
    if (chromaDominantPitches.length > 0) {
      // Use mode (most common) for dominant pitch instead of average
      features.chromaDominantPitch = Math.round(
        chromaDominantPitches.reduce((a, b) => a + b, 0) /
          chromaDominantPitches.length,
      );
    }
    if (tonnetzMeanArrays.length > 0) {
      features.tonnetzMean = this.calculateAverageVector(tonnetzMeanArrays);
    }
    if (tonnetzOverallMeans.length > 0) {
      features.tonnetzOverallMean =
        tonnetzOverallMeans.reduce((a, b) => a + b, 0) /
        tonnetzOverallMeans.length;
    }
    if (spectralCentroids.length > 0) {
      features.spectralCentroid =
        spectralCentroids.reduce((a, b) => a + b, 0) / spectralCentroids.length;
    }
    if (spectralRolloffs.length > 0) {
      features.spectralRolloff =
        spectralRolloffs.reduce((a, b) => a + b, 0) / spectralRolloffs.length;
    }
    if (zeroCrossingRates.length > 0) {
      features.zeroCrossingRate =
        zeroCrossingRates.reduce((a, b) => a + b, 0) / zeroCrossingRates.length;
    }

    // Get all genres and subgenres (as arrays)
    features.genres = Object.keys(genreCounts).filter(
      (genre) => genreCounts[genre] > 0,
    );
    features.subgenres = Object.keys(subgenreCounts).filter(
      (subgenre) => subgenreCounts[subgenre] > 0,
    );
    features.key = this.findMostCommon(keyCounts);
    features.camelotKey = this.findMostCommon(camelotKeyCounts);
    features.artist = this.findMostCommon(artistCounts);
    features.album = this.findMostCommon(albumCounts);
    features.valenceMood = this.findMostCommon(valenceMoodCounts);
    features.arousalMood = this.findMostCommon(arousalMoodCounts);
    features.danceabilityFeeling = this.findMostCommon(
      danceabilityFeelingCounts,
    );

    // Get most common energy keywords (top 5)
    if (allEnergyKeywords.length > 0) {
      const keywordCounts: Record<string, number> = {};
      allEnergyKeywords.forEach((keyword) => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
      features.energyKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword]) => keyword);
    }

    // Aggregate AI metadata (collect unique values and most common)
    if (aiDescriptions.length > 0) {
      features.aiDescriptions = [...new Set(aiDescriptions)];
    }
    if (aiTags.length > 0) {
      const tagCounts: Record<string, number> = {};
      aiTags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      features.aiTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
    }
    if (vocalsDescriptions.length > 0) {
      // Find the most common vocals description
      const vocalsCounts: Record<string, number> = {};
      vocalsDescriptions.forEach((vocals) => {
        vocalsCounts[vocals] = (vocalsCounts[vocals] || 0) + 1;
      });
      const mostCommonVocals = Object.entries(vocalsCounts).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      if (mostCommonVocals) {
        features.vocalsDescriptions = mostCommonVocals;
      }
    }
    if (atmosphereKeywords.length > 0) {
      const atmosphereCounts: Record<string, number> = {};
      atmosphereKeywords.forEach((keyword) => {
        atmosphereCounts[keyword] = (atmosphereCounts[keyword] || 0) + 1;
      });
      features.atmosphereKeywords = Object.entries(atmosphereCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword]) => keyword);
    }
    if (contextBackgrounds.length > 0) {
      // Find the most common context background
      const contextCounts: Record<string, number> = {};
      contextBackgrounds.forEach((context) => {
        contextCounts[context] = (contextCounts[context] || 0) + 1;
      });
      const mostCommonContext = Object.entries(contextCounts).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      if (mostCommonContext) {
        features.contextBackgrounds = mostCommonContext;
      }
    }
    if (contextImpacts.length > 0) {
      // Find the most common context impact
      const impactCounts: Record<string, number> = {};
      contextImpacts.forEach((impact) => {
        impactCounts[impact] = (impactCounts[impact] || 0) + 1;
      });
      const mostCommonImpact = Object.entries(impactCounts).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      if (mostCommonImpact) {
        features.contextImpacts = mostCommonImpact;
      }
    }

    return features;
  }

  private calculateAverageVector(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dimensions = vectors[0].length;
    const average = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        average[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      average[i] /= vectors.length;
    }

    return average;
  }

  private findMostCommon(counts: Record<string, number>): string | undefined {
    let maxCount = 0;
    let mostCommon: string | undefined;

    for (const [key, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = key;
      }
    }

    return mostCommon;
  }

  // Methods for syncing tracks to Elasticsearch
  async syncTrackToElasticsearch(trackId: string): Promise<void> {
    try {
      const track = await this.prisma.musicTrack.findUnique({
        where: { id: trackId },
        include: {
          audioFingerprint: true,
          aiAnalysisResult: true,
          library: true,
          imageSearches: true,
          trackGenres: {
            include: {
              genre: true,
            },
          },
          trackSubgenres: {
            include: {
              subgenre: true,
            },
          },
        },
      });
      if (!track) {
        this.logger.warn(`Track ${trackId} not found for Elasticsearch sync`);
        return;
      }
      const elasticsearchDoc = this.mapTrackToElasticsearchDocument(track);
      await this.elasticsearchService.indexTrack(elasticsearchDoc);

      this.logger.log(`Successfully synced track ${trackId} to Elasticsearch`);
    } catch (error) {
      this.logger.error(
        `Error syncing track ${trackId} to Elasticsearch:`,
        error,
      );
      throw error;
    }
  }

  async syncAllTracksToElasticsearch(): Promise<void> {
    try {
      const tracks = await this.prisma.musicTrack.findMany({
        include: {
          audioFingerprint: true,
          aiAnalysisResult: true,
          library: true,
          imageSearches: true,
          trackGenres: {
            include: {
              genre: true,
            },
          },
          trackSubgenres: {
            include: {
              subgenre: true,
            },
          },
        },
      });

      const elasticsearchDocs = tracks.map((track) =>
        this.mapTrackToElasticsearchDocument(track),
      );

      await this.elasticsearchService.bulkIndexTracks(elasticsearchDocs);

      this.logger.log(
        `Successfully synced ${tracks.length} tracks to Elasticsearch`,
      );
    } catch (error) {
      this.logger.error('Error syncing all tracks to Elasticsearch:', error);
      throw error;
    }
  }

  /**
   * Recreate the entire Elasticsearch index (DESTRUCTIVE)
   */
  async recreateElasticsearchIndex(): Promise<void> {
    try {
      await this.elasticsearchService.recreateIndex();

      // Re-sync all tracks after recreating the index
      await this.syncAllTracksToElasticsearch();

      this.logger.log(
        'Elasticsearch index recreated and re-synced successfully',
      );
    } catch (error) {
      this.logger.error('Error recreating Elasticsearch index:', error);
      throw error;
    }
  }

  /**
   * Update Elasticsearch mapping (for non-breaking changes)
   */
  async updateElasticsearchMapping(): Promise<void> {
    try {
      await this.elasticsearchService.forceUpdateMapping();
      this.logger.log('Elasticsearch mapping updated successfully');
    } catch (error) {
      this.logger.error('Error updating Elasticsearch mapping:', error);
      throw error;
    }
  }

  public mapTrackToElasticsearchDocument(
    track: MusicTrackWithRelations,
  ): ElasticsearchMusicTrackDocument {
    const fingerprint = track.audioFingerprint;
    const aiAnalysis = track.aiAnalysisResult;

    // Helper function to safely parse JSON strings
    const safeJsonParse = (
      jsonString: string | null | undefined,
      defaultValue: any = null,
    ) => {
      if (!jsonString) return defaultValue;
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        this.logger.warn(`Failed to parse JSON: ${jsonString}`);
        return defaultValue;
      }
    };

    // Parse JSON fields from fingerprint
    const mfcc = safeJsonParse(fingerprint?.mfcc, []);
    const spectralCentroid = safeJsonParse(fingerprint?.spectralCentroid, {});
    const spectralRolloff = safeJsonParse(fingerprint?.spectralRolloff, {});
    const spectralSpread = safeJsonParse(fingerprint?.spectralSpread, {});
    const spectralBandwidth = safeJsonParse(fingerprint?.spectralBandwith, {});
    const spectralFlatness = safeJsonParse(fingerprint?.spectralFlatness, {});
    const spectralContrast = safeJsonParse(fingerprint?.spectralContrast, []);
    const chroma = safeJsonParse(fingerprint?.chroma, {});

    const tonnetz = safeJsonParse(fingerprint?.tonnetz, {});
    const zeroCrossingRate = safeJsonParse(fingerprint?.zeroCrossingRate, {});
    const rms = safeJsonParse(fingerprint?.rms, {});
    const energyKeywords = safeJsonParse(fingerprint?.energyKeywords, []);
    const energyByBand = safeJsonParse(fingerprint?.energyByBand, []);
    const userTags = safeJsonParse(track.userTags, []);
    const aiTags = safeJsonParse(track.aiTags, []);

    return {
      // MusicTrack core fields
      id: track.id,
      file_path: track.filePath,
      file_name: track.fileName,
      file_size: track.fileSize,
      duration: track.duration,
      format: track.format,
      bitrate: track.bitrate,
      sample_rate: track.sampleRate,

      // Original Metadata
      original_title: track.originalTitle,
      original_artist: track.originalArtist,
      original_album: track.originalAlbum,
      original_year: track.originalYear,
      original_albumartist: track.originalAlbumartist,
      original_date: track.originalDate,
      original_bpm: track.originalBpm,
      original_track_number: track.originalTrack_number,
      original_disc_number: track.originalDisc_number,
      original_comment: track.originalComment,
      original_composer: track.originalComposer,
      original_copyright: track.originalCopyright,

      // AI-Generated Metadata
      ai_title: track.aiTitle,
      ai_artist: track.aiArtist,
      ai_album: track.aiAlbum,
      ai_confidence: track.aiConfidence,
      ai_subgenre_confidence: track.aiSubgenreConfidence,
      ai_description: track.aiDescription,
      ai_tags: aiTags,
      vocals_desc: track.vocalsDesc,
      atmosphere_desc: safeJsonParse(track.atmosphereDesc, []),
      context_background: track.contextBackground,
      context_impact: track.contextImpact,

      // User Modifications
      user_title: track.userTitle,
      user_artist: track.userArtist,
      user_album: track.userAlbum,
      user_tags: userTags,

      // Listening Data
      listening_count: track.listeningCount,
      last_played_at: track.lastPlayedAt,
      is_favorite: track.isFavorite,

      // Analysis Status
      analysis_status: track.analysisStatus,
      analysis_started_at: track.analysisStartedAt,
      analysis_completed_at: track.analysisCompletedAt,
      analysis_error: track.analysisError,
      has_musicbrainz: track.hasMusicbrainz,
      has_discogs: track.hasDiscogs,

      // Library information
      library_id: track.libraryId,
      library_name: track.library?.name,

      // Timestamps
      created_at: track.createdAt,
      updated_at: track.updatedAt,

      // AudioFingerprint fields - nested structure
      audio_fingerprint: fingerprint
        ? {
            // MFCC as dense vector
            mfcc: mfcc,

            // Spectral Features with statistics
            spectral_centroid: spectralCentroid,
            spectral_rolloff: spectralRolloff,
            spectral_spread: spectralSpread,
            spectral_bandwidth: spectralBandwidth,
            spectral_flatness: spectralFlatness,
            spectral_contrast: spectralContrast,

            // Chroma features
            chroma: chroma,

            // Tonnetz features
            tonnetz: tonnetz,

            // Zero Crossing Rate
            zero_crossing_rate: zeroCrossingRate,

            // RMS
            rms: rms,

            // Musical Features
            tempo: fingerprint.tempo,
            key: fingerprint.key,
            camelot_key: fingerprint.camelotKey,
            valence: fingerprint.valence,
            valence_mood: fingerprint.valenceMood,
            arousal: fingerprint.arousal,
            arousal_mood: fingerprint.arousalMood,
            danceability: fingerprint.danceability,
            danceability_feeling: fingerprint.danceabilityFeeling,
            rhythm_stability: fingerprint.rhythmStability,
            bass_presence: fingerprint.bassPresence,
            tempo_regularity: fingerprint.tempoRegularity,
            tempo_appropriateness: fingerprint.tempoAppropriateness,
            energy_factor: fingerprint.energyFactor,
            syncopation: fingerprint.syncopation,
            acousticness: fingerprint.acousticness,
            instrumentalness: fingerprint.instrumentalness,
            speechiness: fingerprint.speechiness,
            liveness: fingerprint.liveness,
            mode_factor: fingerprint.modeFactor,
            mode_confidence: fingerprint.modeConfidence,
            mode_weight: fingerprint.modeWeight,
            tempo_factor: fingerprint.tempoFactor,
            brightness_factor: fingerprint.brightnessFactor,
            harmonic_factor: fingerprint.harmonicFactor,
            spectral_balance: fingerprint.spectralBalance,
            beat_strength: fingerprint.beatStrength,

            // Hashes
            audio_hash: fingerprint.audioHash,
            file_hash: fingerprint.fileHash,

            // Energy
            energy_comment: fingerprint.energyComment,
            energy_keywords: energyKeywords,
            energy_by_band: energyByBand,
          }
        : null,

      // AIAnalysisResult fields - nested structure
      ai_analysis: aiAnalysis
        ? {
            model_version: aiAnalysis.modelVersion,
            genre_classification: safeJsonParse(
              aiAnalysis.genreClassification,
              {},
            ),
            artist_suggestion: safeJsonParse(aiAnalysis.artistSuggestion, null),
            album_suggestion: safeJsonParse(aiAnalysis.albumSuggestion, null),
            processing_time: aiAnalysis.processingTime,
            error_message: aiAnalysis.errorMessage,
          }
        : null,

      // Genres and Subgenres (from normalized relations)
      genres: track.trackGenres?.map((tg) => tg.genre.name) || [],
      subgenres: track.trackSubgenres?.map((ts) => ts.subgenre.name) || [],

      // Computed display fields (denormalized for convenience)
      title: track.userTitle || track.originalTitle || track.aiTitle,
      artist: track.userArtist || track.originalArtist || track.aiArtist,
      album: track.userAlbum || track.originalAlbum || track.aiAlbum,
      image_path: track.imageSearches?.[0]?.imagePath,
    };
  }
}
