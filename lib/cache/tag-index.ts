// Bidirectional tag↔key index used by cache stores to invalidate by tag.
export class TagIndex {
  private tagToKeys = new Map<string, Set<string>>();
  private keyToTags = new Map<string, Set<string>>();

  add(tag: string, key: string) {
    if (!this.tagToKeys.has(tag)) this.tagToKeys.set(tag, new Set());
    this.tagToKeys.get(tag)!.add(key);
    if (!this.keyToTags.has(key)) this.keyToTags.set(key, new Set());
    this.keyToTags.get(key)!.add(tag);
  }

  keysFor(tag: string): string[] {
    return Array.from(this.tagToKeys.get(tag) ?? []);
  }

  // Called when a key is evicted/deleted — clean up all its tag mappings.
  removeKey(key: string) {
    const tags = this.keyToTags.get(key);
    if (!tags) return;
    for (const t of tags) this.tagToKeys.get(t)?.delete(key);
    this.keyToTags.delete(key);
  }

  // Called after deleteByTag — drop the tag entry itself.
  removeTag(tag: string) {
    const keys = this.tagToKeys.get(tag);
    if (!keys) return;
    for (const k of keys) this.keyToTags.get(k)?.delete(tag);
    this.tagToKeys.delete(tag);
  }

  clear() {
    this.tagToKeys.clear();
    this.keyToTags.clear();
  }

  get size() {
    return this.tagToKeys.size;
  }
}
