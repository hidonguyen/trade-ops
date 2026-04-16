// Invalidate cached entries by tag. Called from mutation handlers after successful DB commits.
import { cacheStore, cacheEnabled } from "./index";

export function invalidateTags(tags: string[]): number {
  if (!cacheEnabled) return 0;
  return tags.reduce((n, tag) => n + cacheStore.deleteByTag(tag), 0);
}
