import { describe, expect, it } from "vitest";
import {
  isValidOwner,
  isValidRepoName,
  parseRepoParams,
  parseUsername,
  parseYear,
} from "@/lib/validation";

describe("isValidOwner", () => {
  it.each(["octocat", "scuton-technology", "a", "A1-b2", "x".repeat(39)])(
    "accepts %s",
    (owner) => {
      expect(isValidOwner(owner)).toBe(true);
    }
  );

  it.each([
    "",
    "-leading",
    "x".repeat(40),
    "has space",
    "under_score",
    "dot.name",
    "<script>",
    "a/b",
    "%2e",
  ])("rejects %j", (owner) => {
    expect(isValidOwner(owner)).toBe(false);
  });
});

describe("isValidRepoName", () => {
  it.each(["next.js", "commit-story", ".github", "under_score", "R2", "x".repeat(100)])(
    "accepts %s",
    (repo) => {
      expect(isValidRepoName(repo)).toBe(true);
    }
  );

  it.each(["", ".", "..", "x".repeat(101), "a b", "a/b", '"><svg onload=1>', "repo?x=1"])(
    "rejects %j",
    (repo) => {
      expect(isValidRepoName(repo)).toBe(false);
    }
  );
});

describe("parseRepoParams", () => {
  it("returns the params when both are valid", () => {
    expect(parseRepoParams({ owner: "vercel", repo: "next.js" })).toEqual({
      ok: true,
      value: { owner: "vercel", repo: "next.js" },
    });
  });

  it("returns a typed 400 error naming the bad field", () => {
    const result = parseRepoParams({ owner: "vercel", repo: ".." });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ status: 400, code: "INVALID_PARAMS" });
    expect(result.error.message).toMatch(/repo/i);
  });
});

describe("parseUsername", () => {
  it("accepts a GitHub login and rejects garbage", () => {
    expect(parseUsername("torvalds")).toEqual({ ok: true, value: "torvalds" });
    expect(parseUsername("bad user").ok).toBe(false);
  });
});

describe("parseYear", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it.each([
    ["2005", 2005],
    ["2024", 2024],
    ["2026", 2026],
  ])("accepts %s", (input, expected) => {
    expect(parseYear(input, now)).toEqual({ ok: true, value: expected });
  });

  it.each(["2004", "2027", "abc", "2024abc", "20.5", "", "-2024", "02024"])(
    "rejects %j",
    (input) => {
      const result = parseYear(input, now);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.status).toBe(400);
    }
  );
});
