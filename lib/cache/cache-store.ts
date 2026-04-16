// Cache store interface + default in-process LRU implementation with tag-based invalidation.
// Swappable: a future RedisCacheStore can satisfy the same interface.
import { LRUCache } from "lru-cache";
import { TagIndex } from "./tag-index";

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  tagCount: number;
}

export interface CacheSetOptions {
  ttlMs?: number;
  tags?: string[];
}

export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, opts?: CacheSetOptions): void;
  delete(key: string): void;
  deleteByTag(tag: string): number;
  clear(): void;
  stats(): CacheStats;
}

interface CacheEntry<T> {
  value: T;
  tags: string[];
}

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const MAX_ENTRIES = 500;

export class LruCacheStore implements CacheStore {
  private lru: LRUCache<string, CacheEntry<unknown>>;
  private tags = new TagIndex();
  private hits = 0;
  private misses = 0;

  constructor() {
    this.lru = new LRUCache<string, CacheEntry<unknown>>({
      max: MAX_ENTRIES,
      ttl: DEFAULT_TTL_MS,
      // Clean tag mappings when an entry is evicted (TTL expiry or max-size eviction).
      dispose: (_value, key) => this.tags.removeKey(key),
    });
  }

  get<T>(key: string): T | undefined {
    const hit = this.lru.get(key) as CacheEntry<T> | undefined;
    if (hit !== undefined) {
      this.hits++;
      return hit.value;
    }
    this.misses++;
    return undefined;
  }

  set<T>(key: string, value: T, opts: CacheSetOptions = {}): void {
    const entry: CacheEntry<T> = { value, tags: opts.tags ?? [] };
    this.lru.set(key, entry as CacheEntry<unknown>, {
      ttl: opts.ttlMs ?? DEFAULT_TTL_MS,
    });
    for (const tag of entry.tags) this.tags.add(tag, key);
  }

  delete(key: string): void {
    // `dispose` will clean the tag index.
    this.lru.delete(key);
  }

  deleteByTag(tag: string): number {
    const keys = this.tags.keysFor(tag);
    for (const k of keys) this.lru.delete(k);
    this.tags.removeTag(tag);
    return keys.length;
  }

  clear(): void {
    this.lru.clear();
    this.tags.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    return {
      size: this.lru.size,
      hits: this.hits,
      misses: this.misses,
      tagCount: this.tags.size,
    };
  }
}
