import { SortingOptions } from 'src/clean-arch/kernel/types';

export const buildMusicTrackSortingOrderClause = (options: SortingOptions) => {
  if (!options) {
    return undefined;
  }
  // Handle sorting by audio fingerprint fields
  let orderByClause: any;
  const audioFingerprintFields = [
    'tempo',
    'key',
    'energy',
    'valence',
    'arousal',
    'danceability',
    'acousticness',
    'instrumentalness',
    'speechiness',
  ];

  const changedNames = {
    lastScannedAt: 'analysisCompletedAt',
    danceabilityFeeling: 'danceability',
    arousalMood: 'arousal',
    valenceMood: 'valence',
  };
  const orderByProp = changedNames[options.orderBy] || options.orderBy;
  if (audioFingerprintFields.includes(orderByProp)) {
    orderByClause = {
      audioFingerprint: {
        [orderByProp]: options.orderDirection,
      },
    };
  } else {
    orderByClause = { [orderByProp]: options.orderDirection };
  }
  return orderByClause;
};
