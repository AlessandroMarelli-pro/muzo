import { Maybe } from 'src/kernel/common';
import { MusicLibraryId, MusicTrackId, SubgenreId } from 'src/kernel/ids';
import {
  AudioFileAnalysisStatusEnum,
  FilterCriteria,
  MusicTrack,
} from 'src/kernel/types/model-types';
import {
  CursorPaginationResult,
  PaginationAndSortingOptions,
  PaginationResult,
  WithCursorPagination,
  WithPagination,
} from 'src/kernel/types/pagination';
import { createToken } from '../../utils/create-token';
import { AudioAnalysisResponse } from '../dtos/AudioAnalysis';

export const MUSIC_TRACK_REPOSITORY = createToken<IMusicTrackRepository>('MUSIC_TRACK_REPOSITORY');

export type MusicTrackUpdateData = {
  hqAudioPath?: string;
  stats?: {
    isFavorite?: boolean;
    isBanger?: boolean;
    isLiked?: boolean;
  };
  filePath: string;
  libraryId: MusicLibraryId;
  fileName: string;
  fileSize: number;
  analysisStatus: AudioFileAnalysisStatusEnum;
  analysisStartedAt: Date;
  analysisCompletedAt: Date;
  analysisError: string;
  duration: number;
  format: string;
  fileCreatedAt: Date;
};

export interface IMusicTrackRepository {
  getAllSubgenresBySubgenreId(_subgenreIds: SubgenreId[]): Promise<SubgenreId[]>;
  getManyByLibraryId(libraryId: MusicLibraryId): Promise<MusicTrack[]>;
  getManyByLibraryIdNotCompleted(libraryId: MusicLibraryId): Promise<MusicTrack[]>;
  getAnalysisStatusForManyByLibraryId(
    libraryId: MusicLibraryId,
  ): Promise<{ analysisStatus: AudioFileAnalysisStatusEnum; count: number }[]>;
  upsertOne(track: Partial<MusicTrackUpdateData>): Promise<MusicTrack>;
  getOneById(id: MusicTrackId): Promise<MusicTrack>;
  areFilesAnalyzed(filePaths: string[]): Promise<{ isAnalyzed: boolean; filePath: string }[]>;
  getLastPlayedTrack(): Promise<Maybe<MusicTrack>>;
  getManyByIds(ids: MusicTrackId[]): Promise<MusicTrack[]>;
  getAll(): Promise<MusicTrack[]>;
  /** Tracks with an existing AudioFingerprint whose embedding hasn't been backfilled yet. */
  getTracksMissingEmbedding(): Promise<MusicTrack[]>;
  verifyExistence(id: MusicTrackId): Promise<boolean>;
  getManyByCriteria(
    criteria: Maybe<FilterCriteria>,
    subgenreSelectionMode: 'exact' | 'contain',
    options: PaginationAndSortingOptions,
    withIncludes?: boolean,
  ): Promise<MusicTrack[]>;
  getManyByCriteriaWithPagination(
    criteria: Maybe<FilterCriteria>,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>>;
  getPendingTracksWithPagination(
    criteria: Maybe<FilterCriteria>,
    pagination: WithPagination,
  ): Promise<PaginationResult<MusicTrack>>;
  getManyByCriteriaWithCursorPagination(
    criteria: Maybe<FilterCriteria>,
    pagination: WithCursorPagination<MusicTrack>,
  ): Promise<CursorPaginationResult<MusicTrack>>;
  getRandomTrackId(): Promise<MusicTrackId>;
  updateOneById(id: MusicTrackId, data: Partial<MusicTrackUpdateData>): Promise<MusicTrack>;
  removeOneById(id: MusicTrackId): Promise<boolean>;
  incrementListeningCount(id: MusicTrackId): Promise<MusicTrack>;
  updateTrackWithAnalysis(
    trackId: MusicTrackId,
    analysisResult: AudioAnalysisResponse,
    filePath: string,
  ): Promise<void>;
}
