/**
 * SAMPLE LISTINGS for design review and tests. Companies are fictional;
 * places are real. Apply links point at example.com (a domain reserved for
 * examples) so nothing real is hit. Phase 1 replaces this with the
 * `internships` table. Dates are relative (days) so samples never go stale.
 */
import type { FieldId } from "@/lib/catalog/fields";
import type { ListingSource, WorkType } from "@/lib/listings/types";
import type { LatLng } from "@/lib/matching/geo";

export type ApplyMethod = { kind: "link"; url: string } | { kind: "email"; email: string };

export type SampleListing = {
  id: string;
  title: string;
  company: string;
  verified: boolean;
  area: string;
  location: LatLng | null;
  workType: WorkType;
  field: FieldId;
  allowance: string | null;
  hours: number | null;
  moa: boolean;
  source: ListingSource;
  /** Negative = closed (is_active false). Closed listings never appear in results. */
  deadlineInDays: number | null;
  postedDaysAgo: number;
  skills: { id: string; required: boolean }[];
  snippet: string;
  apply: ApplyMethod;
};

const req = (id: string) => ({ id, required: true });
const nice = (id: string) => ({ id, required: false });
const link = (slug: string): ApplyMethod => ({ kind: "link", url: `https://example.com/jobs/${slug}` });

export const SAMPLE_LISTINGS: SampleListing[] = [
  {
    id: "tanglaw-iot-firmware",
    title: "IoT Firmware Intern",
    company: "Tanglaw Solar Systems",
    verified: true,
    area: "Cubao, Quezon City",
    location: { lat: 14.6191, lng: 121.0563 },
    workType: "onsite",
    field: "iot",
    allowance: "₱500/day",
    hours: 486,
    moa: true,
    source: "direct",
    deadlineInDays: 5,
    postedDaysAgo: 3,
    skills: [req("c"), req("arduino"), req("sensors"), nice("soldering"), nice("mqtt")],
    snippet:
      "Help our hardware team test and improve the firmware on our solar charge controllers. You'll write C for small microcontrollers, log sensor data, and join weekly field tests.",
    apply: { kind: "email", email: "ojt@tanglaw.example.com" },
  },
  {
    id: "bayanihan-frontend-react",
    title: "Frontend Developer Intern (React)",
    company: "Bayanihan Pay",
    verified: false,
    area: "Legazpi Village, Makati",
    location: { lat: 14.5547, lng: 121.0244 },
    workType: "hybrid",
    field: "web",
    allowance: "With allowance",
    hours: 300,
    moa: true,
    source: "jsearch",
    deadlineInDays: null,
    postedDaysAgo: 4,
    skills: [req("javascript"), req("react"), req("git"), nice("typescript"), nice("testing")],
    snippet:
      "Build screens for our merchant dashboard with React. Two office days a week in Makati, the rest from home.",
    apply: link("bayanihan-frontend-react"),
  },
  {
    id: "kalye-data-analyst",
    title: "Data Analyst OJT",
    company: "Kalye Logistics",
    verified: true,
    area: "Ortigas, Pasig",
    location: { lat: 14.5869, lng: 121.0614 },
    workType: "onsite",
    field: "data",
    allowance: "₱400/day",
    hours: 600,
    moa: true,
    source: "admin",
    deadlineInDays: 3,
    postedDaysAgo: 10,
    skills: [req("ms-excel"), req("sql"), nice("python"), nice("data-visualization")],
    snippet:
      "Clean delivery data, build weekly reports for the operations team, and help find late-delivery patterns across Metro Manila routes.",
    apply: link("kalye-data-analyst"),
  },
  {
    id: "sari-ux-design",
    title: "UX Design Intern",
    company: "Sari Studio",
    verified: true,
    area: "Anywhere in the Philippines",
    location: null,
    workType: "remote",
    field: "design",
    allowance: "With allowance",
    hours: 240,
    moa: false,
    source: "direct",
    deadlineInDays: 12,
    postedDaysAgo: 1,
    skills: [req("figma"), req("prototyping"), nice("user-research")],
    snippet:
      "Design and test app screens for small sari-sari store owners. You'll run short interviews and turn what you learn into Figma prototypes.",
    apply: link("sari-ux-design"),
  },
  {
    id: "kalye-hr-ops",
    title: "HR Operations OJT",
    company: "Kalye Logistics",
    verified: true,
    area: "Ortigas, Pasig",
    location: { lat: 14.5869, lng: 121.0614 },
    workType: "onsite",
    field: "hr",
    allowance: "Unpaid",
    hours: 300,
    moa: true,
    source: "admin",
    deadlineInDays: 6,
    postedDaysAgo: 8,
    skills: [req("ms-excel"), req("recruitment"), nice("labor-code-basics"), nice("communication")],
    snippet: "Support hiring for warehouse and rider roles: screen applications, schedule interviews, and keep records tidy.",
    apply: { kind: "email", email: "hr@kalye.example.com" },
  },
  {
    id: "dagat-accounting",
    title: "Junior Accounting Intern",
    company: "Dagat Freight Forwarders",
    verified: false,
    area: "Port Area, Manila",
    location: { lat: 14.5869, lng: 120.969 },
    workType: "onsite",
    field: "accounting",
    allowance: "₱450/day",
    hours: 500,
    moa: true,
    source: "jsearch",
    deadlineInDays: null,
    postedDaysAgo: 14,
    skills: [req("bookkeeping"), req("ms-excel"), nice("quickbooks"), nice("tax-basics")],
    snippet: "Record shipments and invoices, help with monthly closing, and learn how a freight company handles customs fees.",
    apply: link("dagat-accounting"),
  },
  {
    id: "hiraya-front-office",
    title: "Front Office Trainee",
    company: "Hiraya Suites",
    verified: true,
    area: "Cebu IT Park, Cebu City",
    location: { lat: 10.3304, lng: 123.9057 },
    workType: "onsite",
    field: "hospitality",
    allowance: "Meal + transport allowance",
    hours: 600,
    moa: true,
    source: "direct",
    deadlineInDays: 9,
    postedDaysAgo: 5,
    skills: [req("customer-service"), req("communication"), nice("reservations-systems"), nice("english")],
    snippet: "Welcome guests, handle check-ins, and learn our reservations system. Rotating shifts with a fixed schedule each week.",
    apply: { kind: "email", email: "careers@hiraya.example.com" },
  },
  {
    id: "matibay-civil",
    title: "Civil Engineering Intern",
    company: "Matibay Builders",
    verified: true,
    area: "Lanang, Davao City",
    location: { lat: 7.1004, lng: 125.6318 },
    workType: "onsite",
    field: "engineering",
    allowance: "₱350/day",
    hours: 400,
    moa: true,
    source: "admin",
    deadlineInDays: null,
    postedDaysAgo: 20,
    skills: [req("autocad"), nice("construction-estimating"), nice("site-safety")],
    snippet: "Join site visits for a mid-rise build, update AutoCAD drawings, and help the estimator with material take-offs.",
    apply: link("matibay-civil"),
  },
  {
    id: "kanto-social-media",
    title: "Social Media Intern",
    company: "Kanto Coffee Co.",
    verified: true,
    area: "BGC, Taguig",
    location: { lat: 14.5508, lng: 121.0509 },
    workType: "hybrid",
    field: "comms",
    allowance: "Unpaid",
    hours: 240,
    moa: true,
    source: "direct",
    deadlineInDays: 2,
    postedDaysAgo: 6,
    skills: [req("copywriting"), req("canva"), req("social-media"), nice("photography")],
    snippet: "Plan and post content for our four branches. Shoot drinks, write captions, and track what people respond to.",
    apply: link("kanto-social-media"),
  },
  {
    id: "bayanihan-qa",
    title: "QA Testing Intern",
    company: "Bayanihan Pay",
    verified: false,
    area: "Anywhere in the Philippines",
    location: null,
    workType: "remote",
    field: "web",
    allowance: "With allowance",
    hours: 300,
    moa: true,
    source: "jsearch",
    deadlineInDays: null,
    postedDaysAgo: 2,
    skills: [req("testing"), nice("git"), nice("javascript")],
    snippet: "Test new features before release, write clear bug reports, and help automate the checks we repeat every week.",
    apply: link("bayanihan-qa"),
  },
  {
    id: "ilaw-embedded",
    title: "Embedded Systems Intern",
    company: "Ilaw Robotics",
    verified: true,
    area: "Diliman, Quezon City",
    location: { lat: 14.6537, lng: 121.0687 },
    workType: "onsite",
    field: "iot",
    allowance: "₱450/day",
    hours: 486,
    moa: true,
    source: "direct",
    deadlineInDays: 20,
    postedDaysAgo: 7,
    skills: [req("embedded-systems"), req("c"), nice("pcb-design"), nice("python")],
    snippet: "Work on the controller boards for our school robotics kits: write drivers, test prototypes, and document what you build.",
    apply: link("ilaw-embedded"),
  },
  {
    id: "lakbay-bizdev",
    title: "Business Development Intern",
    company: "Lakbay Travel Tech",
    verified: false,
    area: "Salcedo Village, Makati",
    location: { lat: 14.5603, lng: 121.0228 },
    workType: "hybrid",
    field: "business",
    allowance: "With allowance",
    hours: 300,
    moa: true,
    source: "jsearch",
    deadlineInDays: null,
    postedDaysAgo: 9,
    skills: [req("communication"), req("sales"), nice("ms-excel"), nice("crm-tools")],
    snippet: "Reach out to resorts and tour operators, keep our partner list up to date, and sit in on sales calls.",
    apply: link("lakbay-bizdev"),
  },
  {
    id: "tindahan-marketing",
    title: "Marketing Assistant OJT",
    company: "Tindahan Online",
    verified: true,
    area: "Mandaluyong",
    location: { lat: 14.5794, lng: 121.0359 },
    workType: "onsite",
    field: "business",
    allowance: "₱400/day",
    hours: 300,
    moa: true,
    source: "admin",
    deadlineInDays: 11,
    postedDaysAgo: 4,
    skills: [req("social-media"), nice("copywriting"), nice("canva"), nice("ms-excel")],
    snippet: "Help run promos for our online grocery: schedule posts, answer comments, and report what sold best each week.",
    apply: link("tindahan-marketing"),
  },
  {
    id: "ulap-python",
    title: "Python Automation Intern",
    company: "Ulap Cloud Services",
    verified: true,
    area: "Anywhere in the Philippines",
    location: null,
    workType: "remote",
    field: "data",
    allowance: "₱8,000/month",
    hours: 400,
    moa: true,
    source: "direct",
    deadlineInDays: 15,
    postedDaysAgo: 3,
    skills: [req("python"), req("git"), nice("sql")],
    snippet: "Write small Python scripts that save our support team time, from report exports to tidying customer data.",
    apply: link("ulap-python"),
  },
  {
    // Closed: reachable by its URL (old links), hidden from all results.
    id: "pinoy-games-art",
    title: "2D Game Art Intern",
    company: "Pinoy Pixel Games",
    verified: true,
    area: "Eastwood, Quezon City",
    location: { lat: 14.6091, lng: 121.0779 },
    workType: "hybrid",
    field: "design",
    allowance: "With allowance",
    hours: 300,
    moa: true,
    source: "direct",
    deadlineInDays: -3,
    postedDaysAgo: 40,
    skills: [req("illustration"), req("photoshop"), nice("figma")],
    snippet: "Draw sprites and UI art for a mobile puzzle game, working with our lead artist.",
    apply: link("pinoy-games-art"),
  },
];

export function findSampleListing(id: string): SampleListing | null {
  return SAMPLE_LISTINGS.find((l) => l.id === id) ?? null;
}

export function isClosed(listing: SampleListing): boolean {
  return listing.deadlineInDays !== null && listing.deadlineInDays < 0;
}
