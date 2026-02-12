#!/usr/bin/env bash
# Verify that the squashed migration (single init) produces a DB that matches
# the current schema. Run from backend/.
#
# Usage: ./scripts/verify-squashed-migration.sh
#
# If this script exits 0, the squashed migration is correct. Then run
#   npm run test:integration
# to confirm deploy works in practice. After that you can delete old migrations
# and keep only the init one.

set -e
cd "$(dirname "$0")/.."
PRISMA_DIR="prisma"
MIGRATIONS_DIR="$PRISMA_DIR/migrations"
INIT_NAME="20260210140119_init"
BACKUP_DIR="${MIGRATIONS_DIR}_backup_$$"
VERIFY_DB="$PRISMA_DIR/verify_squash.db"

# 1. Generate expected SQL from current schema (for manual diff if needed)
echo "→ Generating expected SQL from schema.prisma..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$PRISMA_DIR/schema.prisma" \
  --script > "$PRISMA_DIR/expected_from_schema.sql"
echo "  Written to $PRISMA_DIR/expected_from_schema.sql (you can diff with $MIGRATIONS_DIR/$INIT_NAME/migration.sql)"

# 2. Backup current migrations and leave only the init + lock
if [ ! -d "$MIGRATIONS_DIR/$INIT_NAME" ]; then
  echo "Error: $MIGRATIONS_DIR/$INIT_NAME not found. Is your squashed migration named $INIT_NAME?"
  exit 1
fi
echo "→ Backing up migrations and leaving only $INIT_NAME..."
mkdir -p "$BACKUP_DIR"
for f in "$MIGRATIONS_DIR"/*/; do
  [ -d "$f" ] || continue
  name=$(basename "$f")
  if [ "$name" != "$INIT_NAME" ]; then
    mv "$f" "$BACKUP_DIR/"
  fi
done
cp "$MIGRATIONS_DIR/migration_lock.toml" "$BACKUP_DIR/"

# 3. Apply only the squashed migration to a fresh DB
echo "→ Applying single migration to fresh DB..."
rm -f "$VERIFY_DB"
DATABASE_URL="file:$(pwd)/$VERIFY_DB" npx prisma migrate deploy

# 4. Diff: DB (after applying init) vs current schema. Should be empty or only a comment.
echo "→ Checking that applied migration matches schema.prisma..."
DIFF=$(npx prisma migrate diff \
  --from-url "file:$(pwd)/$VERIFY_DB" \
  --to-schema-datamodel "$PRISMA_DIR/schema.prisma" \
  --script 2>/dev/null || true)
# Prisma may output "-- This is an empty migration." when there is no diff; treat as success
EFFECTIVE_DIFF=$(echo "$DIFF" | grep -v '^--' | grep -v '^[[:space:]]*$' || true)
if [ -n "$EFFECTIVE_DIFF" ]; then
  echo "FAIL: The squashed migration does not match the current schema. Diff:"
  echo "$DIFF"
  echo ""
  echo "Restoring migrations..."
  for f in "$BACKUP_DIR"/*/; do
    [ -d "$f" ] && mv "$f" "$MIGRATIONS_DIR/"
  done
  mv "$BACKUP_DIR/migration_lock.toml" "$MIGRATIONS_DIR/"
  rmdir "$BACKUP_DIR" 2>/dev/null || true
  rm -f "$VERIFY_DB"
  exit 1
fi

# 5. Restore backup so repo is unchanged
echo "→ Restoring migrations..."
for f in "$BACKUP_DIR"/*/; do
  [ -d "$f" ] && mv "$f" "$MIGRATIONS_DIR/"
done
mv "$BACKUP_DIR/migration_lock.toml" "$MIGRATIONS_DIR/"
rmdir "$BACKUP_DIR" 2>/dev/null || true
rm -f "$VERIFY_DB"

echo ""
echo "✓ Squashed migration matches schema. Safe to delete old migrations and keep only $INIT_NAME."
echo "  Next: run 'npm run test:integration' then remove the old migration folders and delete $PRISMA_DIR/expected_from_schema.sql if you don't need it."
