export interface CommitData {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
    login: string;
  };
  date: string;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: string[];
}

export interface RepoInfo {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  created_at: string;
  language: string;
}

export interface RepoStory {
  repo: RepoInfo;
  commits: CommitData[];
  contributors: ContributorData[];
  milestones: MilestoneData[];
  stats: RepoStats;
}

export interface ContributorData {
  login: string;
  avatar_url: string;
  contributions: number;
  first_commit: string;
  last_commit: string;
}

export interface MilestoneData {
  type: "first-commit" | "release" | "big-refactor" | "contributor-joined" | "100-commits" | "1000-stars";
  date: string;
  title: string;
  description: string;
  sha?: string;
}

export interface RepoStats {
  total_commits: number;       // Real total (from pagination header)
  commits_shown: number;       // How many are in the commits[] array
  total_contributors: number;  // Real total (paginated)
  total_additions: number;
  total_deletions: number;
  most_active_day: string;
  most_active_author: string;
  avg_commits_per_week: number;
  project_age_days: number;
}

/** One week of the GitHub commit-activity stats endpoint. */
export interface WeekActivity {
  week: number;        // Unix timestamp of week start (Sunday)
  days: number[];      // [Sun, Mon, Tue, Wed, Thu, Fri, Sat] commit counts
  total: number;
}

/** Lightweight repo summary used by the badge and embed widget. */
export interface RepoSummary {
  repo: RepoInfo;
  totalCommits: number;
  contributorCount: number;
}

export interface YearSummary {
  year: number;
  totalCommits: number;
  monthlyCommits: number[];
  /** null when the sampled commits contain no dated commit. */
  mostActiveMonth: string | null;
  uniqueContributors: number;
  repoFullName: string;
}

export interface WrappedLanguage {
  name: string;
  count: number;
}

export interface WrappedRepo {
  name: string;
  full_name: string;
  stars: number;
  language: string;
  description: string;
}

export interface WrappedData {
  user: {
    login: string;
    name: string;
    avatar_url: string;
    bio: string;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
  };
  totalStars: number;
  totalRepos: number;
  languages: WrappedLanguage[];
  topRepos: WrappedRepo[];
}
