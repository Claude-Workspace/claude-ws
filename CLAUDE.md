# CLAUDE.md

Project-specific instructions for Claude Code.

## Language Rule

**Always respond in English, regardless of the user's input language.**

- All responses must be in English
- All code changes, comments, and documentation must be in English
- Even if the user communicates in another language, respond in English

## Plugins

**MUST use `agent-sdk-dev` plugin** when working with Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).

This plugin provides:
- `/new-sdk-app` command to scaffold new SDK applications
- `agent-sdk-verifier-ts` agent to verify TypeScript SDK apps
- `agent-sdk-verifier-py` agent to verify Python SDK apps

Use it for:
- Creating new Agent SDK projects
- Verifying SDK usage and best practices
- Debugging SDK integration issues

Dont try start run dev when finish a conversation only when you are asked to.

## Dependencies Management

**CRITICAL: NO devDependencies - ONLY dependencies**

- **NEVER** add packages to `devDependencies`
- **ALWAYS** add ALL packages to `dependencies` only
- This is a published npm package - all imports must be available in production
- Production code imports from devDependencies will cause build failures
- The `scripts/check-dependencies.sh` script validates this rule before builds

**Why:** When users install this package via npm, devDependencies are not installed. Any production code importing from devDependencies will fail at runtime.

## Database Schema Changes

**CRITICAL: When modifying database schema, update BOTH locations:**

1. **`src/lib/db/schema.ts`** - Drizzle ORM schema (source of truth)
2. **`src/lib/db/index.ts`** - Runtime `initDb()` function

### Why Both?

- `initDb()` runs at app startup and creates/migrates tables for existing users
- Drizzle schema is used for type safety and generating migrations
- If you only update schema.ts without initDb(), existing databases will fail with "no such column" errors

### Steps for Schema Changes

1. Update `src/lib/db/schema.ts` with new columns/tables
2. Add corresponding `ALTER TABLE` or `CREATE TABLE IF NOT EXISTS` in `initDb()` (with try-catch for existing columns)
3. Run `pnpm db:generate` to generate drizzle migration files
4. Test with both fresh and existing databases

### Example: Adding a new column

```typescript
// 1. In schema.ts
myNewColumn: integer('my_new_column').notNull().default(0),

// 2. In index.ts initDb()
try {
  sqlite.exec(`ALTER TABLE my_table ADD COLUMN my_new_column INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}
```

## Language Rule

**Always respond in English, regardless of the user's input language.**

- All responses must be in English
- All code changes, comments, and documentation must be in English
- Even if the user communicates in another language, respond in English