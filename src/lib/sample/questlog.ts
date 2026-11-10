/**
 * SAMPLE quest log for the sample user (mika.codes), for designing W7 before
 * the database exists. Phase 2 replaces this with the user's `applications`
 * rows. Dates are relative to "today" so the sample never goes stale.
 */
import { addDays, type LogEntry } from "@/lib/tracker/log";
import { findSampleListing } from "./listings";

function fromListing(listingId: string, patch: Partial<LogEntry>): LogEntry {
  const l = findSampleListing(listingId);
  return {
    id: `e-${listingId}`,
    listingId,
    title: l?.title ?? "Listing",
    company: l?.company ?? "",
    url: null,
    status: "saved",
    outcome: null,
    appliedOn: null,
    interviewAt: null,
    interviewHow: "",
    note: "",
    awaitingConfirm: false,
    rewarded: [],
    ...patch,
  };
}

export function sampleQuestLog(today: string): LogEntry[] {
  return [
    fromListing("tanglaw-iot-firmware", { awaitingConfirm: true }),
    fromListing("kanto-social-media", {}),
    fromListing("kalye-data-analyst", {}),
    fromListing("sari-ux-design", {}),
    fromListing("bayanihan-qa", { status: "applied", appliedOn: addDays(today, -6), rewarded: ["confirm"] }),
    {
      id: "e-habi",
      listingId: null,
      title: "Junior Web Developer OJT",
      company: "Habi Digital",
      url: "https://example.com/careers/habi-web-ojt",
      status: "applied",
      outcome: null,
      appliedOn: addDays(today, -12),
      interviewAt: null,
      interviewHow: "",
      note: "Found on the school job board. Sent through their Google Form.",
      awaitingConfirm: false,
      rewarded: [],
    },
    fromListing("ilaw-embedded", {
      status: "interview",
      appliedOn: addDays(today, -9),
      interviewAt: `${addDays(today, 3)}T10:00`,
      interviewHow: "Online (Google Meet)",
      note: "Ask about the robotics kit timeline.",
      rewarded: ["confirm", "interview"],
    }),
    fromListing("ulap-python", {
      status: "result",
      outcome: "offer",
      appliedOn: addDays(today, -20),
      rewarded: ["confirm", "interview", "result"],
    }),
    {
      id: "e-batis",
      listingId: null,
      title: "IT Support Intern",
      company: "Batis Water Co.",
      url: null,
      status: "result",
      outcome: "no_reply",
      appliedOn: addDays(today, -30),
      interviewAt: null,
      interviewHow: "",
      note: "",
      awaitingConfirm: false,
      rewarded: [],
    },
  ];
}
