/**
 * Pure, network-free analysis of GitHub data. Everything here is deterministic
 * for a given input (time is always passed in, dates are evaluated in UTC), so
 * it is safe to import from client components and easy to unit test.
 */
import type {
  CommitData,
  ContributorData,
  MilestoneData,
  RepoInfo,
  RepoStats,
  WrappedLanguage,
  WrappedRepo,
} from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const UNKNOWN = "Unknown";
const MILESTONE_TITLE_MAX = 60;
const WRAPPED_TOP_LANGUAGES = 8;
const WRAPPED_TOP_REPOS = 5;

// Bot detection — GitHub marks official bots with [bot] suffix
const BOT_PATTERNS = [
  "[bot]",
  "dependabot",
  "renovate",
  "github-actions",
  "codecov",
  "greenkeeper",
  "snyk-bot",
  "allcontributors",
  "semantic-release",
  "imgbot",
  "netlify",
  "vercel",
  "stale",
];

const CONVENTIONAL_COMMIT = /^(\w+)(\(.+\))?!?:\s/;
const RELEASE_COMMIT = /^(v?\d+\.\d+\.\d+|release|bump version)/i;
const LAST_PAGE = /[?&]page=(\d+)>; rel="last"/;

/** Conventional-commit type (`feat`, `fix`, ...) of a message, or null. */
export function getCommitType(message: string): string | null {
  return CONVENTIONAL_COMMIT.exec(message)?.[1] ?? null;
}

export function isBot(login: string): boolean {
  const lower = login.toLowerCase();
  return BOT_PATTERNS.some((p) => lower.includes(p));
}

/** Last page number from a GitHub `Link` header, or null if absent. */
export function parseLastPage(linkHeader: string | undefined): number | null {
  const match = linkHeader ? LAST_PAGE.exec(linkHeader) : null;
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function parseTime(date: string | null | undefined): number | null {
  if (!date) return null;
  const time = Date.parse(date);
  return Number.isNaN(time) ? null : time;
}

/**
 * Milestones derived from the fetched commit window (newest first, as GitHub
 * returns them). Note: "first-commit" and "100-commits" use the oldest commit
 * in the window, which is only the true first commit for small repositories.
 */
export function detectMilestones(commits: CommitData[], totalCommits: number): MilestoneData[] {
  const milestones: MilestoneData[] = [];
  const oldest = commits[commits.length - 1];

  if (oldest) {
    milestones.push({
      type: "first-commit",
      date: oldest.date,
      title: "First Commit",
      description: `${oldest.author.name} started the project`,
      sha: oldest.sha,
    });

    if (totalCommits >= 100) {
      milestones.push({
        type: "100-commits",
        date: oldest.date,
        title: "100 Commits!",
        description: "Project reached 100 commits",
      });
    }
  }

  for (const commit of commits) {
    if (RELEASE_COMMIT.test(commit.message)) {
      milestones.push({
        type: "release",
        date: commit.date,
        title: (commit.message.split("\n")[0] ?? "").slice(0, MILESTONE_TITLE_MAX),
        description: "New version released",
        sha: commit.sha,
      });
    }
  }

  return milestones.sort((a, b) => (parseTime(a.date) ?? 0) - (parseTime(b.date) ?? 0));
}

/** Whole days since creation, never less than 1 (also for invalid dates). */
export function projectAgeDays(createdAt: string, now: number): number {
  const created = parseTime(createdAt);
  if (created === null) return 1;
  return Math.max(1, Math.floor((now - created) / DAY_MS));
}

/** Weekday (UTC) with the most commits; ties go to the first one seen. */
export function mostActiveDay(commits: CommitData[]): string {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const time = parseTime(c.date);
    if (time === null) continue;
    const day = WEEKDAYS[new Date(time).getUTCDay()] ?? UNKNOWN;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  let best = UNKNOWN;
  let bestCount = 0;
  for (const [day, count] of counts) {
    if (count > bestCount) {
      best = day;
      bestCount = count;
    }
  }
  return best;
}

export function averageCommitsPerWeek(totalCommits: number, ageDays: number): number {
  return parseFloat(((totalCommits / ageDays) * 7).toFixed(1));
}

export interface StatsInput {
  commits: CommitData[];
  /** Bot-filtered, sorted by contributions (GitHub's order). */
  contributors: ContributorData[];
  repo: RepoInfo;
  totalCommits: number;
  now: number;
}

export function calculateStats({ commits, contributors, repo, totalCommits, now }: StatsInput): RepoStats {
  const ageDays = projectAgeDays(repo.created_at, now);
  return {
    total_commits: totalCommits,
    commits_shown: commits.length,
    total_contributors: contributors.length,
    total_additions: commits.reduce((sum, c) => sum + c.stats.additions, 0),
    total_deletions: commits.reduce((sum, c) => sum + c.stats.deletions, 0),
    most_active_day: mostActiveDay(commits),
    most_active_author: contributors[0]?.login ?? UNKNOWN,
    avg_commits_per_week: averageCommitsPerWeek(totalCommits, ageDays),
    project_age_days: ageDays,
  };
}

export interface YearCommitSample {
  date: string | null;
  login: string | null;
}

export interface YearAggregate {
  monthlyCommits: number[];
  mostActiveMonth: string | null;
  uniqueContributors: number;
}

/** Monthly (UTC) commit counts and unique authors for a sample of commits. */
export function aggregateYear(commits: YearCommitSample[]): YearAggregate {
  const monthlyCommits = MONTHS.map(() => 0);
  const authors = new Set<string>();

  for (const c of commits) {
    const time = parseTime(c.date);
    if (time !== null) {
      const month = new Date(time).getUTCMonth();
      monthlyCommits[month] = (monthlyCommits[month] ?? 0) + 1;
    }
    if (c.login) authors.add(c.login);
  }

  const max = Math.max(...monthlyCommits);
  return {
    monthlyCommits,
    mostActiveMonth: max > 0 ? (MONTHS[monthlyCommits.indexOf(max)] ?? null) : null,
    uniqueContributors: authors.size,
  };
}

export interface WrappedRepoInput {
  name: string;
  full_name: string;
  fork: boolean;
  stargazers_count?: number;
  language?: string | null;
  description: string | null;
}

export interface WrappedSummary {
  totalStars: number;
  totalRepos: number;
  languages: WrappedLanguage[];
  topRepos: WrappedRepo[];
}

/** Language ranking, top repos and star total of a user's non-fork repos. */
export function summarizeWrapped(repos: WrappedRepoInput[]): WrappedSummary {
  const own = repos.filter((r) => !r.fork);

  const langCounts = new Map<string, number>();
  for (const r of own) {
    if (r.language) langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
  }
  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, WRAPPED_TOP_LANGUAGES)
    .map(([name, count]) => ({ name, count }));

  const topRepos = [...own]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, WRAPPED_TOP_REPOS)
    .map((r) => ({
      name: r.name,
      full_name: r.full_name,
      stars: r.stargazers_count ?? 0,
      language: r.language ?? UNKNOWN,
      description: r.description ?? "",
    }));

  return {
    totalStars: own.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0),
    totalRepos: own.length,
    languages,
    topRepos,
  };
}
