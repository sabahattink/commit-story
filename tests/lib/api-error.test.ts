import { describe, expect, it, vi } from "vitest";
import { errorResponse, toApiError } from "@/lib/api-error";
import { RepoNotPublicError } from "@/lib/github";

const NOW = Date.parse("2026-01-01T00:00:00Z");

function httpError(status: number, headers: Record<string, string> = {}, message = "GitHub error") {
  return Object.assign(new Error(message), { status, response: { headers } });
}

describe("toApiError", () => {
  it("maps a GitHub 404 to NOT_FOUND", () => {
    expect(toApiError(httpError(404), NOW)).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("treats private repositories as not found", () => {
    expect(toApiError(new RepoNotPublicError("acme", "secret"), NOW)).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("maps an exhausted primary rate limit to 429 with Retry-After from the reset time", () => {
    const reset = String(NOW / 1000 + 120);
    const err = httpError(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset });
    expect(toApiError(err, NOW)).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 120,
    });
  });

  it("maps a secondary rate limit (retry-after header) to 429", () => {
    const err = httpError(403, { "retry-after": "30" }, "You have exceeded a secondary rate limit");
    expect(toApiError(err, NOW)).toMatchObject({ status: 429, retryAfterSeconds: 30 });
  });

  it("maps a plain 429 to RATE_LIMITED", () => {
    expect(toApiError(httpError(429), NOW)).toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });

  it("keeps a non-rate-limit 403 as FORBIDDEN instead of calling it a rate limit", () => {
    const err = httpError(403, { "x-ratelimit-remaining": "4999" }, "Repository access blocked");
    expect(toApiError(err, NOW)).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("maps a rejected server token to a 502", () => {
    expect(toApiError(httpError(401), NOW)).toMatchObject({
      status: 502,
      code: "UPSTREAM_AUTH_FAILED",
    });
  });

  it("maps GitHub 5xx and other HTTP failures to a 502", () => {
    expect(toApiError(httpError(503), NOW)).toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
    expect(toApiError(httpError(422), NOW)).toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });

  it("maps unknown failures to a 500 without leaking their message", () => {
    const result = toApiError(new TypeError("secret internals"), NOW);
    expect(result).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(result.message).not.toContain("secret");
  });
});

describe("errorResponse", () => {
  it("returns a JSON body with error and code, never cached", async () => {
    const res = errorResponse({ status: 404, code: "NOT_FOUND", message: "Repository not found" });
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Repository not found", code: "NOT_FOUND" });
  });

  it("sets Retry-After for rate limits", async () => {
    const res = errorResponse({
      status: 429,
      code: "RATE_LIMITED",
      message: "Rate limited",
      retryAfterSeconds: 42,
    });
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toMatchObject({ retryAfter: 42 });
  });

  it("logs server-side failures", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorResponse({ status: 502, code: "UPSTREAM_ERROR", message: "GitHub failed" });
    errorResponse({ status: 404, code: "NOT_FOUND", message: "nope" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
