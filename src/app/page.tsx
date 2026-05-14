"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const EXAMPLE_USERS = ["torvalds", "gaearon", "sindresorhus"];

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const username = input.trim().replace(/^@/, "");
    if (username) router.push(`/wrapped/${username}`);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#0d1117" }}
    >
      <div className="max-w-lg w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>
            commitstory
          </h1>
          <p className="mt-2 text-lg" style={{ color: "#8b949e" }}>
            Your GitHub, Wrapped.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="username"
            autoFocus
            className="flex-1 rounded-xl px-4 py-3.5 text-sm outline-none"
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
          />
          <button
            type="submit"
            className="flex items-center gap-2 font-semibold px-6 py-3.5 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: "#39d353", color: "#0d1117" }}
          >
            Go <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "#6e7681" }}>Try:</span>
          {EXAMPLE_USERS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => router.push(`/wrapped/${u}`)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e" }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
