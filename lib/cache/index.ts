// Singleton cache store. Uses a globalThis guard to survive Next.js dev-mode HMR reloads.
import { LruCacheStore, type CacheStore } from "./cache-store";

const driver = process.env.CACHE_DRIVER ?? "lru";
export const cacheEnabled = process.env.CACHE_ENABLED !== "false";

declare global {
  var __tradeOpsCacheStore: CacheStore | undefined;
}

function buildStore(): CacheStore {
  if (driver === "lru") return new LruCacheStore();
  throw new Error(`Unknown CACHE_DRIVER: ${driver}`);
}

export const cacheStore: CacheStore =
  globalThis.__tradeOpsCacheStore ?? (globalThis.__tradeOpsCacheStore = buildStore());

export type { CacheStore } from "./cache-store";
