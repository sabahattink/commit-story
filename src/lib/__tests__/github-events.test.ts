import { describe, it, expect } from "vitest";
import { aggregateEvents } from "../github-events";

function pushEvent(isoDate: string, commitCount: number) {
  return {
    type: "PushEvent",
    created_at: isoDate,
    payload: { commits: Array(commitCount).fill({ message: "x" }) },
  };
}

function otherEvent(isoDate: string) {
  return { type: "WatchEvent", created_at: isoDate, payload: {} };
}

describe("aggregateEvents", () => {
  it("counts commits from PushEvents only", () => {
    const events = [
      pushEvent("2025-03-01T10:00:00Z", 3),
      pushEvent("2025-03-01T14:00:00Z", 2),
      otherEvent("2025-03-01T12:00:00Z"),
    ];
    expect(aggregateEvents(events).totalCommits).toBe(5);
  });

  it("returns hasActivity false when no PushEvents", () => {
    const result = aggregateEvents([otherEvent("2025-03-01T10:00:00Z")]);
    expect(result.hasActivity).toBe(false);
    expect(result.totalCommits).toBe(0);
  });

  it("identifies mostActiveDay by UTC day name", () => {
    // 2025-03-04 is a Tuesday
    const events = [
      pushEvent("2025-03-04T10:00:00Z", 5),
      pushEvent("2025-03-03T10:00:00Z", 1),
    ];
    expect(aggregateEvents(events).mostActiveDay).toBe("Tuesday");
  });

  it("identifies mostActiveHour by UTC hour", () => {
    const events = [
      pushEvent("2025-03-01T23:00:00Z", 4),
      pushEvent("2025-03-01T10:00:00Z", 1),
    ];
    expect(aggregateEvents(events).mostActiveHour).toBe(23);
  });

  it("streak is 0 when no commit today", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0] + "T12:00:00Z";
    const result = aggregateEvents([pushEvent(fmt(yesterday), 2)]);
    expect(result.streak).toBe(0);
  });
});
