import { ImageResponse } from "next/og"; // use next/og (not @vercel/og directly) for edge compatibility
import { createOctokit } from "@/lib/octokit";
import { fetchUserActivity } from "@/lib/github-events";

export const runtime = "edge";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

interface RouteParams {
  params: Promise<{ username: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { username } = await params;
  if (!GITHUB_USERNAME_RE.test(username)) return new Response("Invalid username", { status: 400 });

  try {
    const octokit = createOctokit();
    const [userRes, reposRes, activity] = await Promise.all([
      octokit.users.getByUsername({ username }),
      octokit.repos.listForUser({ username, per_page: 100, type: "owner" }),
      fetchUserActivity(username),
    ]);

    const user = userRes.data;
    const repos = reposRes.data.filter((r) => !r.fork);
    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);
    const langMap: Record<string, number> = {};
    for (const r of repos) {
      if (r.language) langMap[r.language] = (langMap[r.language] ?? 0) + 1;
    }
    const topLang = Object.entries(langMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

    return new ImageResponse(
      (
        <div style={{
          width: "1200px", height: "630px", display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center", backgroundColor: "#0d1117",
          fontFamily: "sans-serif", padding: "60px", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "48px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatar_url} width={80} height={80}
              style={{ borderRadius: "50%", border: "3px solid #39d353" }} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#e6edf3", fontSize: "28px", fontWeight: 700 }}>{user.name ?? user.login}</span>
              <span style={{ color: "#8b949e", fontSize: "18px" }}>@{user.login}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "32px" }}>
            {[
              { label: "commits~", value: activity.hasActivity ? `~${activity.totalCommits}` : "—" },
              { label: "stars", value: totalStars.toLocaleString() },
              { label: "#1 language", value: topLang },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                backgroundColor: "#161b22", border: "1px solid #30363d",
                borderRadius: "16px", padding: "20px 36px", minWidth: "240px",
              }}>
                <span style={{ color: "#39d353", fontSize: "36px", fontWeight: 700 }}>{value}</span>
                <span style={{ color: "#8b949e", fontSize: "14px", marginTop: "6px" }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: "32px", right: "48px", color: "#6e7681", fontSize: "16px" }}>
            commitstory.dev
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
      }
    );
  } catch {
    return new Response("Failed to generate image", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
