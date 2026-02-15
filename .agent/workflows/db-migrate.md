---
description: Generate Drizzle ORM database migrations
---

# Database Migrations (Drizzle ORM)

This project uses **SQLite** with **Drizzle ORM**. Migrations are auto-generated from the schema.

## Generate a Migration

// turbo-all

1. Edit the database schema in `src/db/schema.ts`.

2. Generate the SQL migration file:

```sh
npm run db:generate
```

**IMPORTANT**: Do NOT write SQL migration files by hand! Always use `db:generate`.

3. To inspect the database, use Drizzle Studio:

```sh
npm run db:studio
```

4. To reset the database (discard all data), delete `userData/sqlite.db`.

## Resolving Migration Conflicts During Rebase

When rebasing a branch with Drizzle migrations conflicting with upstream (e.g., both have `0023_*.sql`):

1. **Keep upstream's migration files** — they're already deployed to production
2. **Rename your conflicting migration** to the next available index (e.g., `0023_romantic_mantis.sql` → `0025_romantic_mantis.sql`)
3. **Update `drizzle/meta/_journal.json`** to include all migrations with correct indices
4. **Update the snapshot file** (`drizzle/meta/00XX_snapshot.json`) — set `prevId` to reference the previous snapshot's `id`
5. If subsequent commits deleted/modified the migration files, those are now no-ops — stage the renamed files

## Key Files

- **Schema**: `src/db/schema.ts`
- **DB connection**: `src/db/index.ts`
- **Drizzle config**: `drizzle.config.ts`
- **Migrations**: `drizzle/` directory
- **Journal**: `drizzle/meta/_journal.json`
