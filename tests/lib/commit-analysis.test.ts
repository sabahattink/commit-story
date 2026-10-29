import { describe, expect, it } from "vitest";
import {
  aggregateYear,
  averageCommitsPerWeek,
  calculateStats,
  detectMilestones,
  getCommitType,
  isBot,
  mostActiveDay,
  parseLastPage,
  projectAgeDays,
  summarizeWrapped,
} from "@/lib/commit-analysis";
import type { CommitData, ContributorData, RepoInfo } from "@/lib/types";

function commit(overrides: Partial<CommitData> & { date: string }): CommitData {
  return {
    sha: overrides.sha ?? `sha-${overrides.date}`,
    message: overrides.message ?? "chore: update",
    author: overrides.author ?? {
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatar_url: "",
      login: "ada",
    },
    date: overrides.date,
    stats: overrides.stats ?? { additions: 0, deletions: 0, total: 0 },
    files: overrides.files ?? [],
  };
}

function contributor(login: string, contributions: number): ContributorData {
  return { login, avatar_url: "", contributions, first_commit: "", last_commit: "" };
}

const REPO: RepoInfo = {
  name: "demo",
  full_name: "acme/demo",
  description: "",
  stars: 1,
  forks: 0,
  created_at: "2024-01-01T00:00:00Z",
  language: "TypeScript",
};

describe("getCommitType", () => {
  it.each([
    ["feat: add timeline", "feat"],
    ["fix(api): handle 404", "fix"],
    ["docs!: rewrite README", "docs"],
    ["chore(deps)!: bump next", "chore"],
    ["perf: memoize heatmap", "perf"],
    ["feat: subject\n\nbody text", "feat"],
  ])("categorizes %j as %s", (message, expected) => {
    expect(getCommitType(message)).toBe(expected);
  });

  it.each([
    "Merge pull request #12 from acme/branch",
    "feat:missing space",
    "update stuff",
    "",
  ])("returns null for non-conventional message %j", (message) => {
    expect(getCommitType(message)).toBeNull();
  });
});

describe("isBot", () => {
  it.each(["dependabot[bot]", "renovate-bot", "GitHub-Actions", "codecov-io"])(
    "flags %s as a bot",
    (login) => {
      expect(isBot(login)).toBe(true);
    }
  );

  it("does not flag a regular user", () => {
    expect(isBot("octocat")).toBe(false);
  });
});

describe("parseLastPage", () => {
  it("reads the last page number from a GitHub Link header", () => {
    const link =
      '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/commits?per_page=1&page=1234>; rel="last"';
    expect(parseLastPage(link)).toBe(1234);
  });

  it("returns null when there is no last link", () => {
    expect(parseLastPage(undefined)).toBeNull();
    expect(parseLastPage("")).toBeNull();
    expect(parseLastPage('<https://x?page=1>; rel="prev"')).toBeNull();
  });
});

describe("detectMilestones", () => {
  // GitHub returns commits newest first.
  const commits = [
    commit({ date: "2024-03-01T10:00:00Z", message: "v1.2.0", sha: "c3" }),
    commit({ date: "2024-02-01T10:00:00Z", message: "feat: core", sha: "c2" }),
    commit({
      date: "2024-01-01T10:00:00Z",
      message: "initial commit",
      sha: "c1",
      author: { name: "Grace Hopper", email: "", avatar_url: "", login: "grace" },
    }),
  ];

  it("returns no milestones for an empty history", () => {
    expect(detectMilestones([], 0)).toEqual([]);
  });

  it("marks the oldest shown commit as the first commit", () => {
    const first = detectMilestones(commits, 3).find((m) => m.type === "first-commit");
    expect(first).toEqual({
      type: "first-commit",
      date: "2024-01-01T10:00:00Z",
      title: "First Commit",
      description: "Grace Hopper started the project",
      sha: "c1",
    });
  });

  it("adds a 100-commits milestone only when the total reaches 100", () => {
    expect(detectMilestones(commits, 99).some((m) => m.type === "100-commits")).toBe(false);
    const hundred = detectMilestones(commits, 100).find((m) => m.type === "100-commits");
    expect(hundred?.date).toBe("2024-01-01T10:00:00Z");
  });

  it.each(["v1.2.3", "2.0.0 stable", "Release candidate", "bump version to 3.1"])(
    "detects %j as a release",
    (message) => {
      const result = detectMilestones([commit({ date: "2024-05-01T00:00:00Z", message })], 1);
      expect(result.some((m) => m.type === "release")).toBe(true);
    }
  );

  it("does not treat conventional commits mentioning a release as releases", () => {
    const result = detectMilestones(
      [commit({ date: "2024-05-01T00:00:00Z", message: "feat: release notes page" })],
      1
    );
    expect(result.some((m) => m.type === "release")).toBe(false);
  });

  it("uses the first line of a release message, truncated to 60 chars", () => {
    const long = `v9.9.9 ${"x".repeat(80)}\n\nchangelog`;
    const release = detectMilestones([commit({ date: "2024-05-01T00:00:00Z", message: long })], 1)
      .find((m) => m.type === "release");
    expect(release?.title).toBe(long.split("\n")[0]?.slice(0, 60));
    expect(release?.title).toHaveLength(60);
  });

  it("sorts milestones chronologically", () => {
    const dates = detectMilestones(commits, 3).map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("projectAgeDays", () => {
  const now = Date.parse("2024-01-15T00:00:00Z");

  it("counts whole days since creation", () => {
    expect(projectAgeDays("2024-01-01T00:00:00Z", now)).toBe(14);
  });

  it("never returns less than one day", () => {
    expect(projectAgeDays("2024-01-14T23:00:00Z", now)).toBe(1);
  });

  it("falls back to one day for a missing or invalid creation date", () => {
    expect(projectAgeDays("", now)).toBe(1);
    expect(projectAgeDays("not-a-date", now)).toBe(1);
  });
});

describe("mostActiveDay", () => {
  it("returns the weekday with the most commits, evaluated in UTC", () => {
    const result = mostActiveDay([
      // 23:30 UTC on a Monday is Tuesday in UTC+4 — must still count as Monday.
      commit({ date: "2024-01-01T23:30:00Z" }),
      commit({ date: "2024-01-08T23:30:00Z" }),
      commit({ date: "2024-01-02T12:00:00Z" }),
    ]);
    expect(result).toBe("Monday");
  });

  it("returns Unknown when no commit has a valid date", () => {
    expect(mostActiveDay([])).toBe("Unknown");
    expect(mostActiveDay([commit({ date: "" })])).toBe("Unknown");
  });
});

describe("averageCommitsPerWeek", () => {
  it("averages commits per week rounded to one decimal", () => {
    expect(averageCommitsPerWeek(140, 70)).toBe(14);
    expect(averageCommitsPerWeek(10, 3)).toBe(23.3);
  });
});

describe("calculateStats", () => {
  it("combines totals, top author, weekday and weekly average", () => {
    const commits = [
      commit({ date: "2024-01-08T10:00:00Z", stats: { additions: 10, deletions: 2, total: 12 } }),
      commit({ date: "2024-01-01T10:00:00Z", stats: { additions: 5, deletions: 1, total: 6 } }),
    ];
    const stats = calculateStats({
      commits,
      contributors: [contributor("grace", 50), contributor("ada", 10)],
      repo: REPO,
      totalCommits: 140,
      now: Date.parse("2024-03-11T00:00:00Z"), // 70 days after creation
    });

    expect(stats).toEqual({
      total_commits: 140,
      commits_shown: 2,
      total_contributors: 2,
      total_additions: 15,
      total_deletions: 3,
      most_active_day: "Monday",
      most_active_author: "grace",
      avg_commits_per_week: 14,
      project_age_days: 70,
    });
  });

  it("reports Unknown author when there are no contributors", () => {
    const stats = calculateStats({
      commits: [],
      contributors: [],
      repo: REPO,
      totalCommits: 0,
      now: Date.parse("2024-01-02T00:00:00Z"),
    });
    expect(stats.most_active_author).toBe("Unknown");
    expect(stats.most_active_day).toBe("Unknown");
    expect(stats.avg_commits_per_week).toBe(0);
  });
});

describe("aggregateYear", () => {
  it("buckets commits per UTC month and counts unique authors", () => {
    const result = aggregateYear([
      { date: "2024-01-31T23:30:00Z", login: "ada" }, // still January in UTC
      { date: "2024-03-02T10:00:00Z", login: "grace" },
      { date: "2024-03-05T10:00:00Z", login: "ada" },
      { date: "2024-03-09T10:00:00Z", login: null },
    ]);

    expect(result.monthlyCommits).toEqual([1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.uniqueContributors).toBe(2);
    expect(result.mostActiveMonth).toBe("March");
  });

  it("picks the earliest month on a tie", () => {
    const result = aggregateYear([
      { date: "2024-05-01T00:00:00Z", login: "a" },
      { date: "2024-02-01T00:00:00Z", login: "b" },
    ]);
    expect(result.mostActiveMonth).toBe("February");
  });

  it("returns null as the most active month when nothing is dated", () => {
    const result = aggregateYear([{ date: null, login: "ada" }]);
    expect(result.monthlyCommits.every((n) => n === 0)).toBe(true);
    expect(result.mostActiveMonth).toBeNull();
    expect(result.uniqueContributors).toBe(1);
  });
});

describe("summarizeWrapped", () => {
  const repos = [
    { name: "a", full_name: "u/a", fork: false, stargazers_count: 5, language: "Go", description: "A" },
    { name: "b", full_name: "u/b", fork: false, stargazers_count: 50, language: "TypeScript", description: null },
    { name: "c", full_name: "u/c", fork: false, stargazers_count: 1, language: "TypeScript", description: "C" },
    { name: "d", full_name: "u/d", fork: true, stargazers_count: 999, language: "Rust", description: "fork" },
    { name: "e", full_name: "u/e", fork: false, stargazers_count: undefined, language: null, description: "E" },
  ];

  it("ignores forks in every aggregate", () => {
    const result = summarizeWrapped(repos);
    expect(result.totalRepos).toBe(4);
    expect(result.totalStars).toBe(56);
    expect(result.languages.some((l) => l.name === "Rust")).toBe(false);
  });

  it("ranks languages by repo count", () => {
    expect(summarizeWrapped(repos).languages).toEqual([
      { name: "TypeScript", count: 2 },
      { name: "Go", count: 1 },
    ]);
  });

  it("ranks top repos by stars with safe defaults", () => {
    const top = summarizeWrapped(repos).topRepos;
    expect(top.map((r) => r.name)).toEqual(["b", "a", "c", "e"]);
    expect(top[0]).toEqual({
      name: "b",
      full_name: "u/b",
      stars: 50,
      language: "TypeScript",
      description: "",
    });
    expect(top[3]?.language).toBe("Unknown");
  });

  it("limits languages to 8 and top repos to 5", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `r${i}`,
      full_name: `u/r${i}`,
      fork: false,
      stargazers_count: i,
      language: `L${i}`,
      description: null,
    }));
    const result = summarizeWrapped(many);
    expect(result.languages).toHaveLength(8);
    expect(result.topRepos).toHaveLength(5);
  });
});
