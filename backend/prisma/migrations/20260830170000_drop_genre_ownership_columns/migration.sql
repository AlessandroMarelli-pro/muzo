-- Genre / Subgenre are reference data (seeded from the Discogs genre_discogs400
-- taxonomy in the next migration), not user-owned rows. Drop the ownership
-- columns so the analysis path never has to supply a createdById for them.
ALTER TABLE "genres" DROP COLUMN IF EXISTS "createdById";
ALTER TABLE "genres" DROP COLUMN IF EXISTS "updatedById";

ALTER TABLE "subgenres" DROP COLUMN IF EXISTS "createdById";
ALTER TABLE "subgenres" DROP COLUMN IF EXISTS "updatedById";
