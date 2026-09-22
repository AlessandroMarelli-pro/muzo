-- amcheck was installed manually (outside migration history) to diagnose a
-- one-time index-corruption incident, see prisma/scripts/cleanup-duplicate-tracks.ts.
-- That's resolved; nothing in the schema depends on this extension.
DROP EXTENSION IF EXISTS amcheck;
