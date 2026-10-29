import { describe, expect, it, vi } from "vitest";
import { CachedLoader, MemoryLruCache } from "@/lib/cache";

function clock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("MemoryLruCache", () => {
  it("returns undefined for a missing key", async () => {
    const cache = new MemoryLruCache<string>({ maxEntries: 2 });
    expect(await cache.get("nope")).toBeUndefined();
  });

  it("serves a value until its TTL expires", async () => {
    const c = clock();
    const cache = new MemoryLruCache<string>({ maxEntries: 2, now: c.now });
    await cache.set("k", "v", 1000);

    c.advance(999);
    expect(await cache.get("k")).toBe("v");

    c.advance(1);
    expect(await cache.get("k")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entry when full", async () => {
    const cache = new MemoryLruCache<number>({ maxEntries: 2 });
    await cache.set("a", 1, 10_000);
    await cache.set("b", 2, 10_000);
    await cache.get("a"); // "a" is now most recently used
    await cache.set("c", 3, 10_000);

    expect(await cache.get("a")).toBe(1);
    expect(await cache.get("b")).toBeUndefined();
    expect(await cache.get("c")).toBe(3);
  });

  it("overwrites an existing key without growing", async () => {
    const cache = new MemoryLruCache<number>({ maxEntries: 2 });
    await cache.set("a", 1, 10_000);
    await cache.set("a", 2, 10_000);
    expect(cache.size).toBe(1);
    expect(await cache.get("a")).toBe(2);
  });

  it("supports delete and clear", async () => {
    const cache = new MemoryLruCache<number>({ maxEntries: 3 });
    await cache.set("a", 1, 10_000);
    await cache.set("b", 2, 10_000);
    await cache.delete("a");
    expect(await cache.get("a")).toBeUndefined();
    await cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rejects a non-positive capacity", () => {
    expect(() => new MemoryLruCache({ maxEntries: 0 })).toThrow(RangeError);
  });
});

describe("CachedLoader", () => {
  function setup(shouldCache?: (v: string) => boolean) {
    const c = clock();
    const store = new MemoryLruCache<string>({ maxEntries: 10, now: c.now });
    const loader = new CachedLoader<string>({ store, ttlMs: 1000, shouldCache });
    return { c, loader };
  }

  it("calls the loader once while the value is fresh", async () => {
    const { c, loader } = setup();
    const fetch = vi.fn().mockResolvedValue("data");

    expect(await loader.load("k", fetch)).toBe("data");
    c.advance(500);
    expect(await loader.load("k", fetch)).toBe("data");
    expect(fetch).toHaveBeenCalledTimes(1);

    c.advance(500);
    await loader.load("k", fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const { loader } = setup();
    let resolve: (v: string) => void = () => {};
    const fetch = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const a = loader.load("k", fetch);
    const b = loader.load("k", fetch);
    await Promise.resolve();
    resolve("shared");

    expect(await Promise.all([a, b])).toEqual(["shared", "shared"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const { loader } = setup();
    const fetch = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    await expect(loader.load("k", fetch)).rejects.toThrow("boom");
    expect(await loader.load("k", fetch)).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips caching values rejected by shouldCache", async () => {
    const { loader } = setup((v) => v !== "pending");
    const fetch = vi.fn().mockResolvedValue("pending");

    await loader.load("k", fetch);
    await loader.load("k", fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
