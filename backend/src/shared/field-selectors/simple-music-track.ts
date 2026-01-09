import { SimpleMusicTrackInterface } from '../../models';

type SimpleMusicTrackSelect = {
  [K in Exclude<
    keyof SimpleMusicTrackInterface,
    | 'library'
    | 'imageSearches'
    | 'audioFingerprint'
    | 'trackGenres'
    | 'trackSubgenres'
  >]: true;
} & {
  library: {
    select: {
      [K in keyof SimpleMusicTrackInterface['library']]: true;
    };
  };
  imageSearches: {
    select: {
      [K in keyof SimpleMusicTrackInterface['imageSearches'][number]]: true;
    };
  };
  audioFingerprint?: {
    select: {
      [K in keyof NonNullable<
        SimpleMusicTrackInterface['audioFingerprint']
      >]: true;
    };
  };
  trackGenres: {
    select: {
      genre: {
        select: {
          [K in keyof SimpleMusicTrackInterface['trackGenres'][number]['genre']]: true;
        };
      };
    };
  };
  trackSubgenres: {
    select: {
      subgenre: {
        select: {
          [K in keyof SimpleMusicTrackInterface['trackSubgenres'][number]['subgenre']]: true;
        };
      };
    };
  };
};

export const simpleMusicTrackFieldSelectors: SimpleMusicTrackSelect = {
  id: true,
  format: true,
  originalArtist: true,
  aiArtist: true,
  userArtist: true,
  originalTitle: true,
  aiTitle: true,
  userTitle: true,
  duration: true,
  aiDescription: true,
  vocalsDesc: true,
  atmosphereDesc: true,
  contextBackground: true,
  contextImpact: true,
  aiTags: true,
  originalDate: true,
  createdAt: true,
  listeningCount: true,
  lastPlayedAt: true,
  isFavorite: true,
  isLiked: true,
  isBanger: true,
  updatedAt: true,
  analysisCompletedAt: true,
  fileCreatedAt: true,
  libraryId: true,
  library: {
    select: {
      id: true,
      name: true,
    },
  },
  imageSearches: {
    select: {
      imagePath: true,
    },
  },
  audioFingerprint: {
    select: {
      tempo: true,
      key: true,
      valenceMood: true,
      arousalMood: true,
      danceabilityFeeling: true,
      acousticness: true,
      instrumentalness: true,
      speechiness: true,
    },
  },

  trackGenres: {
    select: {
      genre: {
        select: {
          name: true,
        },
      },
    },
  },
  trackSubgenres: {
    select: {
      subgenre: {
        select: {
          name: true,
        },
      },
    },
  },
};
