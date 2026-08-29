// No-op seed script.
//
// Referenced by package.json's `db:seed` and prisma.config.ts's
// `migrations.seed` (both required by `prisma migrate reset`). There is no
// canonical seed data for this project yet -- libraries and tracks are
// populated by scanning, not seeding.
async function main() {
  // Intentionally empty.
}

main();
