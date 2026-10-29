import { invalidParams, type ApiError } from "./api-error";

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

// GitHub logins: alphanumerics and hyphens, no leading hyphen, max 39 chars.
// Trailing/double hyphens are tolerated because some legacy accounts have them.
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
// GitHub repo names: alphanumerics, ".", "-", "_", max 100 chars.
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const YEAR_RE = /^[1-9]\d{3}$/;
/** Git itself dates from 2005; earlier years cannot hold meaningful history. */
export const MIN_YEAR = 2005;

export function isValidOwner(owner: string): boolean {
  return OWNER_RE.test(owner);
}

export function isValidRepoName(repo: string): boolean {
  return REPO_RE.test(repo) && repo !== "." && repo !== "..";
}

export interface RepoParams {
  owner: string;
  repo: string;
}

export function parseRepoParams({ owner, repo }: RepoParams): Result<RepoParams> {
  if (!isValidOwner(owner)) return { ok: false, error: invalidParams("Invalid GitHub owner name") };
  if (!isValidRepoName(repo)) return { ok: false, error: invalidParams("Invalid GitHub repo name") };
  return { ok: true, value: { owner, repo } };
}

export function parseUsername(username: string): Result<string> {
  return isValidOwner(username)
    ? { ok: true, value: username }
    : { ok: false, error: invalidParams("Invalid GitHub username") };
}

/** Accepts a 4-digit year between MIN_YEAR and the current UTC year. */
export function parseYear(input: string, now: Date = new Date()): Result<number> {
  const year = YEAR_RE.test(input) ? Number(input) : NaN;
  const maxYear = now.getUTCFullYear();
  if (Number.isNaN(year) || year < MIN_YEAR || year > maxYear) {
    return { ok: false, error: invalidParams(`Year must be between ${MIN_YEAR} and ${maxYear}`) };
  }
  return { ok: true, value: year };
}
