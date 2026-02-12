import { PrismaClient } from '@prisma/client';
import { vi, type MockInstance } from 'vitest';

/** Each delegate (e.g. playlist) is an object whose methods are vi.fn() mocks. */
export type DelegateMock = Record<string, MockInstance>;

function createDelegateMock(): DelegateMock {
  const methods: Record<string, MockInstance> = {};
  return new Proxy({} as DelegateMock, {
    get(_, prop) {
      const key = String(prop);
      if (!methods[key]) methods[key] = vi.fn();
      return methods[key];
    },
  });
}

/**
 * Creates a deep mock of PrismaClient for unit testing persistence adapters.
 * Use with Nest TestingModule: { provide: PRISMA_SERVICE, useValue: createMockPrisma() }
 * Each delegate (e.g. musicLibrary) is cached so test and repo use the same mock.
 * Follows the approach from Prisma's testing guide (vi.fn() for spying and mockResolvedValue).
 * @see https://www.prisma.io/blog/testing-series-2-xPhjjmIEsM
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const delegates: Record<string, ReturnType<typeof createDelegateMock>> = {};
  const getDelegate = (name: string) => {
    if (!delegates[name]) delegates[name] = createDelegateMock();
    return delegates[name];
  };
  const $queryRaw = vi.fn();
  const $transaction = vi.fn();
  const checkConnection = vi.fn();
  return {
    get musicLibrary() {
      return getDelegate('musicLibrary');
    },
    get musicTrack() {
      return getDelegate('musicTrack');
    },
    get playlist() {
      return getDelegate('playlist');
    },
    get playlistTrack() {
      return getDelegate('playlistTrack');
    },
    get playlistSorting() {
      return getDelegate('playlistSorting');
    },
    get queue() {
      return getDelegate('queue');
    },
    get scanSession() {
      return getDelegate('scanSession');
    },
    get savedFilter() {
      return getDelegate('savedFilter');
    },
    get audioFingerprint() {
      return getDelegate('audioFingerprint');
    },
    get trackGenre() {
      return getDelegate('trackGenre');
    },
    get trackSubgenre() {
      return getDelegate('trackSubgenre');
    },
    get genre() {
      return getDelegate('genre');
    },
    get subgenre() {
      return getDelegate('subgenre');
    },
    get imageSearch() {
      return getDelegate('imageSearch');
    },
    get thirdPartyOAuthToken() {
      return getDelegate('thirdPartyOAuthToken');
    },
    get hiddenMusicTrack() {
      return getDelegate('hiddenMusicTrack');
    },
    get $queryRaw() {
      return $queryRaw;
    },
    get $transaction() {
      return $transaction;
    },
    get checkConnection() {
      return checkConnection;
    },
  } as unknown as DeepMockProxy<PrismaClient>;
}

/**
 * Type for PrismaClient deep mock: delegates are DelegateMock (so .create, .findMany, etc.
 * are MockInstance with mockResolvedValue), and $queryRaw, $transaction, checkConnection are MockInstance.
 */
export type DeepMockProxy<T> = {
  [K in keyof T]: K extends '$queryRaw' | '$transaction' | 'checkConnection'
    ? MockInstance
    : DelegateMock;
};
