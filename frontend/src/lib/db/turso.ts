import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client";
import { logger } from "../logger.ts";

/**
 * Singleton instance of the Turso/libSQL database client
 * Supports both edge runtime and Node.js runtime
 */
let dbInstance: Client | null = null;
let dbSource: {
  url: string;
  kind: "turso" | "file";
  configured: boolean;
  reason?: string;
} | null = null;

/**
 * Tracks the in-flight (or settled) `PRAGMA foreign_keys = ON` promise for the
 * current singleton. Used by {@link getDbReady} to await FK enablement before
 * returning the client to INSERT paths.
 *
 * NOTE on libSQL/SQLite FK semantics:
 *  - SQLite defaults to `foreign_keys = OFF`.
 *  - `PRAGMA foreign_keys` is *per-connection*. @libsql/client multiplexes a
 *    connection pool behind a single `Client`, so a single PRAGMA execute is
 *    NOT guaranteed to apply to every pooled connection. This means FK
 *    enforcement here is best-effort and MUST NOT be relied upon as the sole
 *    integrity guard. INSERT paths that need referential integrity should
 *    still validate parent rows explicitly (e.g. `SELECT 1 FROM tasks WHERE
 *    id=?` before inserting an agent_run) — see DATA-FK-01-run-validation,
 *    owned by the SWARM lane in src/app/api/agents/run/route.ts.
 */
let fkReadyPromise: Promise<void> | null = null;

/**
 * Creates or returns the singleton database client
 * Supports edge runtime (http mode) and Node.js runtime (file-based)
 * 
 * @throws Error if TURSO_DB_URL is not set
 * @returns Configured libSQL client instance
 */
function createClient_(): Client {
  const configuredUrl = process.env.TURSO_DB_URL?.trim();
  const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
  const fallbackUrl = `file:./.chaotang-main-${env}.db`;
  const dbUrl = configuredUrl || fallbackUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  dbSource = {
    url: dbUrl,
    kind: dbUrl.startsWith("file:") ? "file" : "turso",
    configured: Boolean(configuredUrl),
    reason: configuredUrl ? undefined : "TURSO_DB_URL not set; using local libSQL primary DB",
  };

  if (!configuredUrl) {
    logger.warn("TURSO_DB_URL is not set; using local libSQL primary DB", {
      url: fallbackUrl,
      env,
    });
  }

  // For local file-based development or file:// URLs
  if (dbUrl.startsWith("file:")) {
    return createClient({
      url: dbUrl,
    });
  }

  // For Turso cloud database (https:// or libsql:// URLs with auth token)
  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN environment variable is not set. " +
      "Required for connecting to Turso cloud databases."
    );
  }

  return createClient({
    url: dbUrl,
    authToken: authToken,
  });
}

/**
 * Best-effort enablement of foreign-key enforcement on the singleton client.
 *
 * Idempotent: the underlying `PRAGMA foreign_keys = ON` is issued at most once
 * per singleton lifetime and the resulting promise is cached in
 * {@link fkReadyPromise}. Failures are logged (never thrown) so that callers
 * relying on the synchronous {@link getDb} contract are not affected.
 *
 * @param client - the freshly created (or existing) singleton client
 * @returns a promise that settles once the PRAGMA execute resolves/rejects
 */
function ensureForeignKeys(client: Client): Promise<void> {
  if (!fkReadyPromise) {
    fkReadyPromise = client
      .execute("PRAGMA foreign_keys = ON")
      .then(() => undefined)
      .catch((error: unknown) => {
        // Do not propagate: FK enforcement is per-connection best-effort and
        // INSERT paths must validate parents explicitly regardless.
        logger.error("Failed to enable PRAGMA foreign_keys", {
          err: error instanceof Error ? error.message : String(error),
        });
      });
  }
  return fkReadyPromise;
}

/**
 * Returns the singleton database client instance.
 * Lazily initializes on first call and reuses the same instance thereafter.
 *
 * On first initialization this fires a best-effort, fire-and-forget
 * `PRAGMA foreign_keys = ON` (see {@link ensureForeignKeys}). The PRAGMA is
 * NOT awaited here so the synchronous signature (relied upon by many call
 * sites) is preserved. Callers that need FK enforcement applied *before*
 * issuing an INSERT should prefer {@link getDbReady}.
 *
 * @returns Singleton Client instance connected to Turso/libSQL database
 */
export function getDb(): Client {
  if (!dbInstance) {
    dbInstance = createClient_();
    // Fire-and-forget: kick off FK enablement without blocking the sync return.
    void ensureForeignKeys(dbInstance);
  }
  return dbInstance;
}

export function primaryDbSource(): {
  url: string;
  kind: "turso" | "file";
  configured: boolean;
  reason?: string;
} {
  if (!dbSource) {
    const configuredUrl = process.env.TURSO_DB_URL?.trim();
    const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
    const url = configuredUrl || `file:./.chaotang-main-${env}.db`;
    return {
      url,
      kind: url.startsWith("file:") ? "file" : "turso",
      configured: Boolean(configuredUrl),
      reason: configuredUrl ? undefined : "TURSO_DB_URL not set; using local libSQL primary DB",
    };
  }
  return dbSource;
}

export function primaryDbUsingLocalFile(): boolean {
  const source = primaryDbSource();
  return source.kind === "file" && !source.configured;
}

/**
 * Async variant of {@link getDb} that awaits the best-effort
 * `PRAGMA foreign_keys = ON` before returning the client.
 *
 * Recommended for INSERT paths (e.g. agent_runs) where having FK enforcement
 * attempted up-front is preferable. Because the PRAGMA is per-connection and
 * @libsql/client pools connections, this is still best-effort — INSERT paths
 * should additionally validate parent rows explicitly (see the class-level
 * note on {@link fkReadyPromise}).
 *
 * @returns Singleton Client instance with FK enablement attempted
 */
export async function getDbReady(): Promise<Client> {
  if (!dbInstance) {
    dbInstance = createClient_();
  }
  await ensureForeignKeys(dbInstance);
  return dbInstance;
}

/**
 * For testing purposes: allows resetting the singleton instance
 * @internal
 */
export function resetDbClient(): void {
  dbInstance = null;
  fkReadyPromise = null;
}
