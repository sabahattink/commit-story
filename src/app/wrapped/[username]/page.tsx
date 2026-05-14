"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Star, Twitter, Linkedin, Link2, Check } from "lucide-react";

interface ActivityData {
  totalCommits: number;
  periodLabel: string;
  mostActiveDay: string;
  mostActiveHour: number;
  streak: number;
  hasActivity: boolean;
}

interface WrappedData {
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
  languages: { name: string; count: number }[];
  topRepos: {
    name: string;
    full_name: string;
    stars: number;
    language: string;
    description: string;
  }[];
  activity: ActivityData;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
  Rust: "#dea584", Go: "#00ADD8", Java: "#b07219", "C++": "#f34b7d",
  C: "#555555", Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138",
  Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89e051", HTML: "#e34c26",
  CSS: "#563d7c", Vue: "#41b883", Svelte: "#ff3e00",
};

const DAY_BARS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WrappedPage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError("");
    fetch(`/api/wrapped/${username}`)
      .then((r) => {
        if (!r.ok) return r.json().then((b: { error?: string }) => { throw new Error(b.error ?? "Error"); });
        return r.json() as Promise<WrappedData>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [username]);

  const memberYears = data
    ? Math.floor((Date.now() - new Date(data.user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;
  const maxLang = data?.languages[0]?.count ?? 1;
  const topLang = data?.languages[0]?.name ?? "Unknown";
  const pageUrl = typeof window !== "undefined" ? window.location.href : `https://commitstory.dev/wrapped/${username}`;
  const tweetText = data
    ? encodeURIComponent(`My GitHub stats⚡\n\n~${data.activity.totalCommits} commits · ${data.totalStars} stars\nTop language: ${topLang}\n\n`)
    : "";
  const tweetUrl = encodeURIComponent(pageUrl);

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: "#0d1117" }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/" className="inline-flex text-xs mb-2" style={{ color: "#8b949e" }}>
          ← Try another username
        </Link>

        {loading && (
          <div className="space-y-4">
            {[160, 140, 120].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "#161b22" }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#161b22", border: "1px solid #30363d" }}>
            <p className="text-base font-semibold mb-2" style={{ color: "#f85149" }}>{error}</p>
            <Link href="/" className="text-sm" style={{ color: "#8b949e" }}>Try another username</Link>
          </div>
        )}

        {data && (
          <>
            {/* Card 1: Hero */}
            <div className="rounded-2xl p-8 text-center" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.user.avatar_url} alt={data.user.login}
                width={96} height={96}
                className="rounded-full mx-auto mb-4"
                style={{ border: "3px solid #39d353", boxShadow: "0 0 20px #39d35330" }}
              />
              <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>{data.user.name}</h1>
              <p className="text-sm mb-1" style={{ color: "#8b949e" }}>@{data.user.login}</p>
              {data.user.bio && <p className="text-sm max-w-sm mx-auto mb-4" style={{ color: "#8b949e" }}>{data.user.bio}</p>}
              <div className="flex justify-center gap-8 mt-4">
                {[
                  { label: "commits~", value: data.activity.hasActivity ? `~${data.activity.totalCommits}` : "—", color: "#39d353" },
                  { label: "stars", value: data.totalStars.toLocaleString(), color: "#e3b341" },
                  { label: "repos", value: String(data.totalRepos), color: "#e6edf3" },
                  { label: "followers", value: data.user.followers.toLocaleString(), color: "#8b949e" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6e7681" }}>{label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4" style={{ color: "#6e7681" }}>
                Member for {memberYears} year{memberYears !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Card 2: Activity */}
            {data.activity.hasActivity && (
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="text-center mb-5">
                  <p className="text-3xl font-bold" style={{ color: "#39d353" }}>~{data.activity.totalCommits}</p>
                  <p className="text-sm mt-1" style={{ color: "#8b949e" }}>commits in the {data.activity.periodLabel} (UTC)</p>
                </div>
                <div className="flex justify-center gap-6 text-sm mb-5 flex-wrap">
                  <span style={{ color: "#8b949e" }}>Most active: <strong style={{ color: "#e6edf3" }}>{data.activity.mostActiveDay}</strong></span>
                  <span style={{ color: "#8b949e" }}>Peak hour: <strong style={{ color: "#e6edf3" }}>{data.activity.mostActiveHour}:00 UTC</strong></span>
                  {data.activity.streak > 0 && (
                    <span style={{ color: "#8b949e" }}>Streak: <strong style={{ color: "#e6edf3" }}>{data.activity.streak}d 🔥</strong></span>
                  )}
                </div>
                <div className="flex items-end justify-center gap-1.5">
                  {DAY_BARS.map((day) => (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <div className="w-7 rounded-sm" style={{
                        height: data.activity.mostActiveDay.startsWith(day) ? "32px" : "12px",
                        background: data.activity.mostActiveDay.startsWith(day) ? "#39d353" : "#21262d",
                      }} />
                      <span className="text-xs" style={{ color: "#6e7681" }}>{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card 3: Languages */}
            {data.languages.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Top Languages</h2>
                <div className="space-y-2.5">
                  {data.languages.slice(0, 6).map((lang) => (
                    <div key={lang.name} className="flex items-center gap-3">
                      <span className="text-xs w-24 text-right shrink-0" style={{ color: "#8b949e" }}>{lang.name}</span>
                      <div className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: "#21262d" }}>
                        <div className="h-full rounded-md" style={{
                          width: `${Math.max(8, (lang.count / maxLang) * 100)}%`,
                          background: LANG_COLORS[lang.name] ?? "#8b949e",
                          opacity: 0.85,
                        }} />
                      </div>
                      <span className="text-xs w-6" style={{ color: "#6e7681" }}>{lang.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card 4: Top Repos */}
            {data.topRepos.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Top Repositories</h2>
                <div className="space-y-3">
                  {data.topRepos.map((repo) => (
                    <a key={repo.full_name} href={`https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer"
                      className="block rounded-xl p-4" style={{ background: "#0d1117", border: "1px solid #30363d" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: "#e6edf3" }}>{repo.name}</span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: "#e3b341" }}>
                          <Star className="w-3 h-3" />{repo.stars.toLocaleString()}
                        </span>
                      </div>
                      {repo.description && <p className="text-xs line-clamp-1" style={{ color: "#8b949e" }}>{repo.description}</p>}
                      {repo.language && (
                        <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: (LANG_COLORS[repo.language] ?? "#8b949e") + "20", color: LANG_COLORS[repo.language] ?? "#8b949e" }}>
                          {repo.language}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Card 5: Share */}
            <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <p className="text-sm font-semibold mb-4 text-center" style={{ color: "#e6edf3" }}>Share your stats</p>
              <div className="flex justify-center gap-3 flex-wrap">
                <a href={`https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                  style={{ background: "#1d9bf0", color: "#ffffff" }}>
                  <Twitter className="w-3.5 h-3.5" />Twitter / X
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${tweetUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                  style={{ background: "#0a66c2", color: "#ffffff" }}>
                  <Linkedin className="w-3.5 h-3.5" />LinkedIn
                </a>
                <button type="button"
                  onClick={() => { navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="inline-flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-lg"
                  style={{ background: "#21262d", border: "1px solid #30363d", color: copied ? "#39d353" : "#8b949e" }}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>

            <p className="text-center text-xs pb-6" style={{ color: "#6e7681" }}>
              Commit counts approximate (last ~90 days, UTC). Language stats from most recently updated 100 repos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
