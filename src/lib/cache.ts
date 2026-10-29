/**
 * Small caching layer used to reduce GitHub API rate-limit pressure.
 *
 * `CacheStore` is async so a shared store (e.g. Redis) can be dropped in later
 * without touching callers. Today only the in-process LRU exists: on
 * serverless hosts each warm instance keeps its own cache, which is still a
 * large win for popular repos and for the badge/embed endpoints.
 */
export interface CacheStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface MemoryLruCacheOptions {
  maxEntries: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

/** Bounded in-memory cache with per-entry TTL and least-recently-used eviction. */
export class MemoryLruCache<T> implements CacheStore<T> {
  // Map preserves insertion order; re-inserting on read keeps it in LRU order.
  private readonly entries = new Map<string, Entry<T>>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor({ maxEntries, now = Date.now }: MemoryLruCacheOptions) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError(`maxEntries must be a positive integer, got ${maxEntries}`);
    }
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get size(): number {
    return this.entries.size;
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

export interface CachedLoaderOptions<T> {
  store: CacheStore<T>;
  ttlMs: number;
  /** Return false to skip caching a value (e.g. "still computing" results). */
  shouldCache?: (value: T) => boolean;
}

/**
 * Read-through cache: serves fresh values from the store, otherwise runs the
 * loader once per key even under concurrent requests. Failures are never cached.
 */
export class CachedLoader<T> {
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly options: CachedLoaderOptions<T>) {}

  async load(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.options.store.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = this.fetchAndStore(key, loader);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetchAndStore(key: string, loader: () => Promise<T>): Promise<T> {
    const value = await loader();
    const { store, ttlMs, shouldCache } = this.options;
    if (!shouldCache || shouldCache(value)) {
      await store.set(key, value, ttlMs);
    }
    return value;
  }
}
