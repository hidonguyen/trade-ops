// Read-through cache helper for GET route handlers.
// Usage: const data = await withCache({ key, tags, ttlMs }, () => prisma.X.findMany(...));
import { cacheStore, cacheEnabled } from "./index";

export interface WithCacheOptions {
  key: string;
  tags?: string[];
  ttlMs?: number;
}

export async function withCache<T>(
  opts: WithCacheOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!cacheEnabled) return fetcher();
  const hit = cacheStore.get<T>(opts.key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cacheStore.set(opts.key, value, { ttlMs: opts.ttlMs, tags: opts.tags });
  return value;
}
