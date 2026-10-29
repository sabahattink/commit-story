import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_PARAMS"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "UPSTREAM_AUTH_FAILED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ApiError {
  status: number;
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

/** JSON body of every API error response. */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  retryAfter?: number;
}

const DEFAULT_RETRY_AFTER_SECONDS = 60;

interface HttpLikeError {
  status: number;
  message: string;
  headers: Record<string, string | number | undefined>;
}

/** Duck-types Octokit's RequestError (and our own status-bearing errors). */
function asHttpError(err: unknown): HttpLikeError | null {
  if (typeof err !== "object" || err === null || !("status" in err)) return null;
  const { status } = err;
  if (typeof status !== "number") return null;
  const message = err instanceof Error ? err.message : "";
  const response = "response" in err ? err.response : undefined;
  const headers =
    typeof response === "object" && response !== null && "headers" in response &&
    typeof response.headers === "object" && response.headers !== null
      ? (response.headers as HttpLikeError["headers"])
      : {};
  return { status, message, headers };
}

function header(headers: HttpLikeError["headers"], name: string): string | undefined {
  const value = headers[name];
  return value === undefined ? undefined : String(value);
}

function retryAfterSeconds(headers: HttpLikeError["headers"], now: number): number {
  const retryAfter = Number(header(headers, "retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);
  const reset = Number(header(headers, "x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return Math.max(1, Math.ceil(reset - now / 1000));
  return DEFAULT_RETRY_AFTER_SECONDS;
}

function isRateLimit(err: HttpLikeError): boolean {
  if (err.status === 429) return true;
  if (err.status !== 403) return false;
  return (
    header(err.headers, "x-ratelimit-remaining") === "0" ||
    header(err.headers, "retry-after") !== undefined ||
    /rate limit/i.test(err.message)
  );
}

/** Maps any thrown value (usually an Octokit RequestError) to a typed API error. */
export function toApiError(err: unknown, now: number = Date.now()): ApiError {
  const http = asHttpError(err);
  if (!http) {
    return { status: 500, code: "INTERNAL_ERROR", message: "Unexpected server error" };
  }
  if (http.status === 404) {
    return { status: 404, code: "NOT_FOUND", message: "Not found on GitHub (it may not exist or be private)" };
  }
  if (isRateLimit(http)) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message: "GitHub API rate limit reached, please retry later",
      retryAfterSeconds: retryAfterSeconds(http.headers, now),
    };
  }
  if (http.status === 403) {
    return { status: 403, code: "FORBIDDEN", message: "GitHub denied access to this resource" };
  }
  if (http.status === 401) {
    return { status: 502, code: "UPSTREAM_AUTH_FAILED", message: "GitHub rejected the server credentials" };
  }
  return { status: 502, code: "UPSTREAM_ERROR", message: "GitHub API request failed" };
}

export function invalidParams(message: string): ApiError {
  return { status: 400, code: "INVALID_PARAMS", message };
}

/** Serializes an ApiError; errors are never cached and 5xx are logged. */
export function errorResponse(error: ApiError): NextResponse<ApiErrorBody> {
  if (error.status >= 500) {
    console.error(`[api] ${error.code} (${error.status}): ${error.message}`);
  }
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  const body: ApiErrorBody = { error: error.message, code: error.code };
  if (error.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(error.retryAfterSeconds);
    body.retryAfter = error.retryAfterSeconds;
  }
  return NextResponse.json(body, { status: error.status, headers });
}
