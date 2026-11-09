/**
 * Fixed school list (decision M8), so leaderboard groups don't split into
 * "TIP QC", "T.I.P. Quezon City", and "tip". SAMPLE ONLY: Phase 1 seeds the
 * full list (for example from CHED's list of higher education institutions).
 */

export const SCHOOLS = [
  { id: "tip-qc", name: "T.I.P. Quezon City" },
  { id: "tip-manila", name: "T.I.P. Manila" },
  { id: "up-diliman", name: "University of the Philippines Diliman" },
  { id: "pup-manila", name: "Polytechnic University of the Philippines (Manila)" },
  { id: "ust", name: "University of Santo Tomas" },
  { id: "dlsu", name: "De La Salle University" },
  { id: "admu", name: "Ateneo de Manila University" },
  { id: "mapua", name: "Mapúa University" },
  { id: "feu-tech", name: "FEU Institute of Technology" },
  { id: "usc", name: "University of San Carlos" },
  { id: "usep", name: "University of Southeastern Philippines" },
] as const;

export type SchoolId = (typeof SCHOOLS)[number]["id"];

/** Optional profile status (SPEC §2). Not the quest log statuses. */
export const PROFILE_STATUSES = [
  { id: "student", label: "Student" },
  { id: "fresh-grad", label: "Fresh graduate" },
  { id: "career-shifter", label: "Career shifter" },
  { id: "other", label: "Other" },
] as const;
