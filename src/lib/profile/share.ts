/**
 * Share card (SPEC §10): level, EXP, applications, and streak, with a link
 * back. The user picks what's on it. Pure, so the wording is tested and the
 * on-screen card and the downloaded image always say the same thing.
 *
 * Privacy: the card links to the site's home page, never to a profile page.
 * There are no public profile pages in v1.
 */

export type ShareOptions = {
  username: boolean;
  level: boolean;
  exp: boolean;
  applications: boolean;
  streak: boolean;
};

export type ShareStats = {
  username: string;
  level: number;
  totalExp: number;
  applications: number;
  streakWeeks: number;
};

/** EXP is off by default: a big number means little to people who don't use the app. */
export const DEFAULT_SHARE: ShareOptions = { username: true, level: true, exp: false, applications: true, streak: true };

export type ShareLine = { key: keyof Omit<ShareOptions, "username">; text: string };

const n = (x: number) => x.toLocaleString("en-US");

/**
 * The stat lines on the card, in a fixed order. `streakAllowed` is false in
 * Light mode or when streaks are turned off. Zero streaks are never shown.
 */
export function shareLines(stats: ShareStats, show: ShareOptions, streakAllowed: boolean): ShareLine[] {
  const lines: ShareLine[] = [];
  if (show.level) lines.push({ key: "level", text: `Level ${stats.level}` });
  if (show.applications) {
    lines.push({
      key: "applications",
      text: `${n(stats.applications)} ${stats.applications === 1 ? "application" : "applications"} sent`,
    });
  }
  if (show.streak && streakAllowed && stats.streakWeeks > 0) {
    lines.push({ key: "streak", text: `${stats.streakWeeks}-week streak` });
  }
  if (show.exp) lines.push({ key: "exp", text: `${n(stats.totalExp)} EXP` });
  return lines;
}

/** Text for "Copy text": the same facts as the card, then the link. */
export function shareText(stats: ShareStats, show: ShareOptions, streakAllowed: boolean, url: string): string {
  const who = show.username ? `${stats.username} on InternQuest` : "My InternQuest progress";
  const facts = shareLines(stats, show, streakAllowed).map((l) => l.text);
  return `${who}: ${facts.length ? facts.join(" · ") : "finding an internship, one quest at a time"}. ${url}`;
}

/** At least one thing must be on the card. */
export function canShare(show: ShareOptions, lines: ShareLine[]): boolean {
  return show.username || lines.length > 0;
}
