import { Octokit } from "@octokit/rest";

import {
  calculateStats,
  detectMilestones,
  isBot,
  parseLastPage,
} from "./commit-analysis";
import type { CommitData, ContributorData, RepoInfo, RepoStory } from "./types";

export type * from "./types";

export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return {
      name: data.name,
      full_name: data.full_name,
      description: data.description || "",
      stars: data.stargazers_count,
      forks: data.forks_count,
      created_at: data.created_at || "",
      language: data.language || "Unknown",
    };
  }

  /**
   * Get real total commit count using pagination header trick.
   * Requests 1 commit and reads the `Link` header's last page number.
   */
  async getTotalCommitCount(owner: string, repo: string): Promise<number> {
    try {
      const response = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });
      const lastPage = parseLastPage(response.headers.link);
      if (lastPage !== null) return lastPage;
      // No pagination link = only 1 page of results
      return response.data.length;
    } catch (err) {
      // Rethrow rate-limit / auth errors so buildStory fails fast
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 429 || e.status === 401) throw err;
      // For other errors (empty repo, etc.) return 0
      return 0;
    }
  }

  /**
   * Get latest 100 commits for timeline/display.
   */
  async getCommits(owner: string, repo: string): Promise<CommitData[]> {
    const { data } = await this.octokit.repos.listCommits({
      owner,
      repo,
      per_page: 100,
      page: 1,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name || "Unknown",
        email: commit.commit.author?.email || "",
        avatar_url: commit.author?.avatar_url || "",
        login: commit.author?.login || "unknown",
      },
      date: commit.commit.author?.date || "",
      stats: { additions: 0, deletions: 0, total: 0 },
      files: [],
    }));
  }

  /**
   * Get all contributors with pagination (up to 500).
   * Filters out bots.
   */
  async getAllContributors(owner: string, repo: string): Promise<ContributorData[]> {
    const all: ContributorData[] = [];
    const PER_PAGE = 100;
    const MAX_PAGES = 5;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await this.octokit.repos.listContributors({
        owner,
        repo,
        per_page: PER_PAGE,
        page,
      });

      if (data.length === 0) break;

      for (const c of data) {
        const login = c.login ?? "unknown";
        if (!isBot(login)) {
          all.push({
            login,
            avatar_url: c.avatar_url ?? "",
            contributions: c.contributions,
            first_commit: "",
            last_commit: "",
          });
        }
      }

      if (data.length < PER_PAGE) break;
    }

    return all;
  }

  async buildStory(owner: string, repo: string): Promise<RepoStory> {
    // Run repo info + commits + contributors + total count in parallel
    const [repoInfo, commits, contributors, totalCommits] = await Promise.all([
      this.getRepoInfo(owner, repo),
      this.getCommits(owner, repo),
      this.getAllContributors(owner, repo),
      this.getTotalCommitCount(owner, repo),
    ]);

    const realTotal = Math.max(totalCommits, commits.length);
    const milestones = detectMilestones(commits, realTotal);
    const stats = calculateStats({
      commits,
      contributors,
      repo: repoInfo,
      totalCommits: realTotal,
      now: Date.now(),
    });

    return {
      repo: repoInfo,
      commits,
      contributors,
      milestones,
      stats,
    };
  }
}
