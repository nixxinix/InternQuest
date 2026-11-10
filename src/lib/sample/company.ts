/**
 * SAMPLE company account and admin queue for designing W13 and W14 (fictional
 * names, example.com addresses). Phase 6 replaces these with the companies,
 * internships, reports, and admin_audit tables.
 */
import type { QueueItem } from "@/lib/admin/queue";
import type { PostingDraft } from "@/lib/company/posting";

export type CompanyStatus = "pending" | "approved" | "rejected";

export const SAMPLE_COMPANY = {
  name: "Tanglaw Solar Systems",
  email: "hr@tanglaw.example.com",
  website: "https://tanglaw.example.com",
  rejectReason: "Email domain doesn't match the website",
};

export type CompanyPosting = {
  id: string;
  title: string;
  status: "active" | "draft" | "closed";
  applyClicks: number;
  /** Days until the deadline (active), or days since it closed. */
  deadlineInDays: number | null;
  updatedDaysAgo: number;
};

export const SAMPLE_POSTINGS: CompanyPosting[] = [
  { id: "tanglaw-iot-firmware", title: "IoT Firmware Intern", status: "active", applyClicks: 128, deadlineInDays: 5, updatedDaysAgo: 3 },
  { id: "tanglaw-installer", title: "Solar Installation Trainee", status: "active", applyClicks: 41, deadlineInDays: 19, updatedDaysAgo: 8 },
  { id: "tanglaw-marketing", title: "Marketing Intern", status: "draft", applyClicks: 0, deadlineInDays: null, updatedDaysAgo: 1 },
  { id: "tanglaw-cad", title: "CAD Drafting Intern", status: "closed", applyClicks: 96, deadlineInDays: -30, updatedDaysAgo: 30 },
  { id: "tanglaw-qa", title: "Quality Assurance OJT", status: "closed", applyClicks: 57, deadlineInDays: -64, updatedDaysAgo: 64 },
];

export const SAMPLE_EDIT_DRAFT: PostingDraft = {
  title: "IoT Firmware Intern",
  field: "iot",
  description:
    "Help our hardware team test and improve the firmware on our solar charge controllers. You'll write C for small microcontrollers, log sensor data, and join weekly field tests.",
  skills: [
    { id: "c", required: true },
    { id: "arduino", required: true },
    { id: "sensors", required: true },
    { id: "soldering", required: false },
    { id: "mqtt", required: false },
  ],
  city: "Quezon City",
  area: "Cubao",
  workType: "onsite",
  allowance: { kind: "amount", text: "₱500/day" },
  hours: "486",
  moa: true,
  startDate: "",
  deadline: "",
  apply: { kind: "email", email: "ojt@tanglaw.example.com" },
};

export const SAMPLE_QUEUE: QueueItem[] = [
  {
    kind: "company",
    id: "c-tanglaw",
    name: "Tanglaw Solar Systems",
    email: "hr@tanglaw.example.com",
    website: "https://tanglaw.example.com",
    role: "HR Officer",
    registrationNo: null,
    submittedHoursAgo: 2,
    emailConfirmed: true,
    websiteLoads: true,
    draftListings: 1,
  },
  {
    kind: "company",
    id: "c-kalye",
    name: "Kalye Logistics",
    email: "people@kalye.example.com",
    website: "https://www.kalye.example.com",
    role: "Recruitment Lead",
    registrationNo: "SEC CS2019-04512",
    submittedHoursAgo: 26,
    emailConfirmed: true,
    websiteLoads: true,
    draftListings: 2,
  },
  {
    kind: "company",
    id: "c-bright",
    name: "BrightFuture Careers",
    email: "admin@brightfuture-jobs.example.net",
    website: "https://brightfuture.example.org",
    role: "Owner",
    registrationNo: null,
    submittedHoursAgo: 49,
    emailConfirmed: true,
    websiteLoads: false,
    draftListings: 6,
  },
  {
    kind: "report",
    id: "r-easyojt",
    listingTitle: "Remote Data Encoder (Paid OJT)",
    company: "EasyOJT Hub",
    snippet: "Earn while you train! A ₱1,500 starter kit fee secures your slot. Training starts once payment is confirmed.",
    reasons: [
      { reason: "payment", count: 4 },
      { reason: "scam", count: 1 },
    ],
    notes: ["They asked me to send the fee through an e-wallet before the interview."],
    submittedHoursAgo: 5,
  },
  {
    kind: "report",
    id: "r-kanto",
    listingTitle: "Social Media Intern",
    company: "Kanto Coffee Co.",
    snippet: "Plan and post content for our four branches. Shoot drinks, write captions, and track what people respond to.",
    reasons: [{ reason: "closed", count: 1 }],
    notes: [],
    submittedHoursAgo: 30,
  },
  {
    kind: "flag",
    id: "f-speedy",
    username: "speedy.apply",
    pattern: "31 confirmations in 1 hour",
    detail: "31 “Yes, I applied” confirmations between 2:04 and 2:51 AM. 29 of them were within 10 seconds of the Apply click.",
    expAtStake: 215,
    submittedHoursAgo: 8,
  },
];
