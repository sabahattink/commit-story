import { createOctokit } from "./octokit";

export interface ActivityData {
  totalCommits: number;
  periodLabel: string;
  mostActiveDay: string;
  mostActiveHour: number;
  streak: number;
  hasActivity: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawEvent = { type: string; created_at: string; payload: any };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function aggregateEvents(events: RawEvent[]): ActivityData {
  const pushEvents = events.filter((e) => e.type === "PushEvent");

  if (pushEvents.length === 0) {
    return {
      totalCommits: 0,
      periodLabel: "last 90 days",
      mostActiveDay: "Unknown",
      mostActiveHour: 0,
      streak: 0,
      hasActivity: false,
    };
  }

  let totalCommits = 0;
  const dayCount: number[] = new Array(7).fill(0);
  const hourCount: number[] = new Array(24).fill(0);
  const commitDates = new Set<string>();

  for (const event of pushEvents) {
    const count: number = event.payload?.commits?.length ?? 0;
    totalCommits += count;
    const date = new Date(event.created_at);
    dayCount[date.getUTCDay()] += count;
    hourCount[date.getUTCHours()] += count;
    commitDates.add(event.created_at.split("T")[0]);
  }

  const mostActiveDayIndex = dayCount.indexOf(Math.max(...dayCount));
  const mostActiveHour = hourCount.indexOf(Math.max(...hourCount));

  const todayStr = new Date().toISOString().split("T")[0];
  let streak = 0;
  if (commitDates.has(todayStr)) {
    const current = new Date(todayStr);
    while (commitDates.has(current.toISOString().split("T")[0])) {
      streak++;
      current.setUTCDate(current.getUTCDate() - 1);
    }
  }

  return {
    totalCommits,
    periodLabel: "last 90 days",
    mostActiveDay: DAY_NAMES[mostActiveDayIndex],
    mostActiveHour,
    streak,
    hasActivity: true,
  };
}

export async function fetchUserActivity(username: string): Promise<ActivityData> {
  const octokit = createOctokit();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEvents: RawEvent[] = [];

  for (let page = 1; page <= 3; page++) {
    const { data } = await octokit.activity.listPublicEventsForUser({
      username,
      per_page: 100,
      page,
    });
    // @ts-expect-error Octokit types are broad — payload exists at runtime
    allEvents.push(...data);
    if (data.length < 100) break;
  }

  return aggregateEvents(allEvents);
}
