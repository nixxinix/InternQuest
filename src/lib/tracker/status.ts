/** Quest log statuses and result outcomes (SPEC §5.6, decision M5). */

export const STATUSES = ["saved", "applied", "interview", "result"] as const;
export type Status = (typeof STATUSES)[number];

export const OUTCOMES = ["offer", "not_selected", "no_reply", "withdrew"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  result: "Result",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  offer: "Got an offer",
  not_selected: "Not selected",
  no_reply: "No reply",
  withdrew: "I withdrew",
};

/** Next-step hint shown on a card after it moves (USER_FLOWS §4). Wording avoids made-up statistics. */
export function nextStepHint(status: Status, outcome?: Outcome | null): { text: string; href: string } | null {
  switch (status) {
    case "saved":
      return { text: "Check the skills fit, then apply", href: "#match" };
    case "applied":
      return { text: "A follow-up message you can send", href: "/tips/application#follow-up" };
    case "interview":
      return { text: "Prepare for your interview", href: "/tips/interview" };
    case "result":
      if (outcome === "offer") return { text: "Questions to ask before you say yes", href: "/tips/interview#offer" };
      if (outcome === "not_selected") return { text: "How to ask for feedback", href: "/tips/interview#rejection" };
      return null;
  }
}
