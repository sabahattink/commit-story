import { NextResponse } from "next/server";
import { createOctokit } from "@/lib/octokit";
import { fetchUserActivity } from "@/lib/github-events";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

interface RouteParams {
  params: Promise<{ username: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { username } = await params;

  if (!GITHUB_USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Invalid GitHub username" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const octokit = createOctokit();

    const [userRes, reposRes, activity] = await Promise.all([
      octokit.users.getByUsername({ username }),
      octokit.repos.listForUser({ username, sort: "updated", per_page: 100, type: "owner" }),
      fetchUserActivity(username),
    ]);

    const user = userRes.data;
    const repos = reposRes.data.filter((r) => !r.fork);

    const langMap: Record<string, number> = {};
    for (const r of repos) {
      if (r.language) langMap[r.language] = (langMap[r.language] ?? 0) + 1;
    }
    const languages = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topRepos = [...repos]
      .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
      .slice(0, 3)
      .map((r) => ({
        name: r.name,
        full_name: r.full_name,
        stars: r.stargazers_count ?? 0,
        language: r.language ?? "Unknown",
        description: r.description ?? "",
      }));

    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);

    return NextResponse.json(
      {
        user: {
          login: user.login,
          name: user.name ?? user.login,
          avatar_url: user.avatar_url,
          bio: user.bio ?? "",
          public_repos: user.public_repos,
          followers: user.followers,
          following: user.following,
          created_at: user.created_at,
        },
        totalStars,
        totalRepos: repos.length,
        languages,
        topRepos,
        activity,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
      }
    );
  } catch (err) {
    const e = err as { status?: number };
    const status = e.status === 404 ? 404 : e.status === 403 || e.status === 429 ? 429 : 500;
    const message =
      status === 404 ? "User not found" :
      status === 429 ? "GitHub API rate limit reached — try again in a few minutes" :
      "Something went wrong";

    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
