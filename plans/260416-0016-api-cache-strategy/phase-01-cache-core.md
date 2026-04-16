# Phase 01 — Cache core abstractions

## Context Links
- [plan.md](./plan.md)
- New: `lib/cache/cache-store.ts`, `lib/cache/tag-index.ts`, `lib/cache/with-cache.ts`, `lib/cache/invalidate.ts`

## Overview
- **Priority:** Critical (blocks all other phases)
- **Status:** Planned
- **Brief:** Build a minimal, swappable cache abstraction. In-process LRU by default. Tag-based invalidation.

## Requirements

1. `CacheStore` interface: `get(key)`, `set(key, value, ttlMs, tags?)`, `delete(key)`, `deleteByTag(tag)`, `clear()`, `stats()`.
2. `LruCacheStore` — default implementation using `lru-cache` npm package. Cap: 500 entries, default TTL 5min.
3. `TagIndex` — map `tag → Set<key>`. Updated on `set`, cleaned on `delete/deleteByTag`.
4. `withCache({ key, tags, ttlMs, fetch })` — helper: if hit, return cached; else call fetch, cache result, return.
5. `invalidateTags(tags: string[])` — call `store.deleteByTag(tag)` for each.
6. Env toggle: `CACHE_ENABLED` (default true). When false, `withCache` calls `fetch()` directly and skips cache.
7. Singleton store exported from `lib/cache/index.ts` so all routes share one instance.

## Architecture

```
lib/cache/
├── cache-store.ts     — Interface + LruCacheStore (default impl)
├── tag-index.ts       — Tag→keys reverse index
├── with-cache.ts      — Caching wrapper for GET handlers
├── invalidate.ts      — invalidateTags helper
└── index.ts           — Singleton export (picks impl from env)
```

**Key derivation contract:** Callers build keys like `"catalog:currencies"`, `"reports:summary:bu=${buId}:from=${d}:to=${d}"`. Never include raw user-submitted content without sanitization.

## Implementation Steps

### Step 1 — Dependencies
```bash
npm install lru-cache
```

### Step 2 — `lib/cache/cache-store.ts` (~60 lines)

```ts
import { LRUCache } from "lru-cache";
import { TagIndex } from "./tag-index";

export interface CacheEntry<T> { value: T; tags: string[]; }

export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, opts?: { ttlMs?: number; tags?: string[] }): void;
  delete(key: string): void;
  deleteByTag(tag: string): number; // returns count invalidated
  clear(): void;
  stats(): { size: number; hits: number; misses: number; tagCount: number };
}

const DEFAULT_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

export class LruCacheStore implements CacheStore {
  private lru: LRUCache<string, CacheEntry<unknown>>;
  private tags = new TagIndex();
  private hits = 0;
  private misses = 0;

  constructor() {
    this.lru = new LRUCache({
      max: MAX_ENTRIES,
      ttl: DEFAULT_TTL_MS,
      dispose: (_v, key) => this.tags.removeKey(key),
    });
  }

  get<T>(key: string): T | undefined {
    const hit = this.lru.get(key) as CacheEntry<T> | undefined;
    if (hit) { this.hits++; return hit.value; }
    this.misses++;
    return undefined;
  }

  set<T>(key: string, value: T, opts: { ttlMs?: number; tags?: string[] } = {}) {
    const entry: CacheEntry<T> = { value, tags: opts.tags ?? [] };
    this.lru.set(key, entry as CacheEntry<unknown>, { ttl: opts.ttlMs ?? DEFAULT_TTL_MS });
    for (const t of entry.tags) this.tags.add(t, key);
  }

  delete(key: string) { this.lru.delete(key); /* tag cleanup via dispose */ }

  deleteByTag(tag: string): number {
    const keys = this.tags.keysFor(tag);
    for (const k of keys) this.lru.delete(k);
    this.tags.removeTag(tag);
    return keys.length;
  }

  clear() { this.lru.clear(); this.tags.clear(); this.hits = 0; this.misses = 0; }

  stats() { return { size: this.lru.size, hits: this.hits, misses: this.misses, tagCount: this.tags.size }; }
}
```

### Step 3 — `lib/cache/tag-index.ts` (~30 lines)

```ts
export class TagIndex {
  private tagToKeys = new Map<string, Set<string>>();
  private keyToTags = new Map<string, Set<string>>();

  add(tag: string, key: string) {
    if (!this.tagToKeys.has(tag)) this.tagToKeys.set(tag, new Set());
    this.tagToKeys.get(tag)!.add(key);
    if (!this.keyToTags.has(key)) this.keyToTags.set(key, new Set());
    this.keyToTags.get(key)!.add(tag);
  }

  keysFor(tag: string): string[] { return Array.from(this.tagToKeys.get(tag) ?? []); }

  removeKey(key: string) {
    const tags = this.keyToTags.get(key);
    if (!tags) return;
    for (const t of tags) this.tagToKeys.get(t)?.delete(key);
    this.keyToTags.delete(key);
  }

  removeTag(tag: string) {
    const keys = this.tagToKeys.get(tag);
    if (!keys) return;
    for (const k of keys) this.keyToTags.get(k)?.delete(tag);
    this.tagToKeys.delete(tag);
  }

  clear() { this.tagToKeys.clear(); this.keyToTags.clear(); }
  get size() { return this.tagToKeys.size; }
}
```

### Step 4 — `lib/cache/index.ts` (~15 lines)

```ts
import { LruCacheStore, type CacheStore } from "./cache-store";

const enabled = process.env.CACHE_ENABLED !== "false";

// Singleton — shared across all API route modules
export const cacheStore: CacheStore = new LruCacheStore();
export const cacheEnabled = enabled;

export { type CacheStore } from "./cache-store";
```

### Step 5 — `lib/cache/with-cache.ts` (~25 lines)

```ts
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
```

### Step 6 — `lib/cache/invalidate.ts` (~8 lines)

```ts
import { cacheStore, cacheEnabled } from "./index";

export function invalidateTags(tags: string[]): number {
  if (!cacheEnabled) return 0;
  return tags.reduce((n, t) => n + cacheStore.deleteByTag(t), 0);
}
```

### Step 7 — Compile check
`npx tsc --noEmit`

## Todo List
- [ ] Install `lru-cache`
- [ ] Implement `cache-store.ts` + `LruCacheStore`
- [ ] Implement `tag-index.ts`
- [ ] Implement `index.ts` singleton
- [ ] Implement `with-cache.ts`
- [ ] Implement `invalidate.ts`
- [ ] Type-check

## Success Criteria
- All 5 files compile clean
- Singleton import works from any route
- Unit sanity-check via ad-hoc script: set → get → invalidate-by-tag → expect miss

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Memory leak in dev HMR (multiple module loads) | `globalThis` singleton guard if observed; skip for v1 |
| TTL granularity limited by LRU lib | lru-cache supports per-entry ttl — verified |

## Unresolved Questions
- None.
