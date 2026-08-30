// Seed script.
//
// Libraries and tracks are populated by scanning, not seeding. The one thing we
// do seed is the Discogs `genre_discogs400` taxonomy (genres + styles): the
// audio-analysis path would otherwise create these rows on demand and race on
// the `genres_name_key` / `subgenres_name_key` unique constraints when tracks
// are analyzed concurrently. Seeding the fixed list makes that path read-only.
//
// Referenced by package.json's `db:seed` and prisma.config.ts's
// `migrations.seed` (both required by `prisma migrate reset`). Idempotent:
// re-running skips rows that already exist.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { flattenTaxonomy } from './data/discogs-genre-taxonomy';

const url = process.env.DATABASE_URL ?? 'postgresql://muzo:muzo@localhost:5432/muzo';
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function seedDiscogsGenreTaxonomy() {
  const { genres, subgenres } = flattenTaxonomy();

  await prisma.genre.createMany({
    data: genres.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const genreRows = await prisma.genre.findMany({
    where: { name: { in: genres } },
    select: { id: true, name: true },
  });
  const genreIdByName = new Map(genreRows.map((g) => [g.name, g.id]));

  await prisma.subgenre.createMany({
    data: [...subgenres].map(([name, parent]) => ({
      name,
      genreId: genreIdByName.get(parent) ?? null,
    })),
    skipDuplicates: true,
  });

  console.log(
    `Seeded Discogs taxonomy: ${genres.length} genres, ${subgenres.size} subgenres (existing rows skipped).`,
  );
}

async function main() {
  await seedDiscogsGenreTaxonomy();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
