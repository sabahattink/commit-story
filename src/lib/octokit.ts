import { Octokit } from "@octokit/rest";

let _instance: Octokit | null = null;

export function createOctokit(): Octokit {
  if (!_instance) {
    if (!process.env.GITHUB_TOKEN) {
      console.warn(
        "GITHUB_TOKEN not set — using unauthenticated GitHub API (60 req/hr limit)"
      );
    }
    _instance = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _instance;
}
