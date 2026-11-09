/**
 * Curated free learning resources per skill (SPEC §6, `skill_resources`).
 * One source of truth: the Match Panel reads this list, and `npm run db:seed`
 * writes it to the database. Each has a stable id, used by /learn/:id.
 *
 * Only free, official, or long-running sources, preferring ones that work on
 * a phone. Sites move pages around: before launch (and every few months) the
 * admin should open every link once (Phase 7 pilot checklist). Two skills have
 * no link yet (reservations systems, construction estimating): free material
 * worth recommending is rare there.
 */
import type { LearningResource } from "@/lib/listings/types";

type Entry = Omit<LearningResource, "id">;

const LIST: Record<string, Entry[]> = {
  // IoT & embedded
  arduino: [{ title: "Arduino documentation", url: "https://docs.arduino.cc/", type: "docs" }],
  c: [{ title: "Learn C (interactive tutorial)", url: "https://www.learn-c.org/", type: "course" }],
  sensors: [{ title: "Sensor guides (Adafruit Learning System)", url: "https://learn.adafruit.com/category/sensors", type: "article" }],
  soldering: [{ title: "Adafruit Guide to Excellent Soldering", url: "https://learn.adafruit.com/adafruit-guide-excellent-soldering", type: "article" }],
  mqtt: [{ title: "MQTT Essentials (HiveMQ)", url: "https://www.hivemq.com/mqtt/mqtt-essentials/", type: "article" }],
  iot: [{ title: "Introduction to IoT (Cisco Networking Academy)", url: "https://www.netacad.com/courses/introduction-iot", type: "course" }],
  "embedded-systems": [
    { title: "Raspberry Pi microcontroller documentation", url: "https://www.raspberrypi.com/documentation/microcontrollers/", type: "docs" },
  ],
  "raspberry-pi": [
    { title: "Raspberry Pi projects (official)", url: "https://projects.raspberrypi.org/en", type: "course" },
    { title: "Raspberry Pi documentation", url: "https://www.raspberrypi.com/documentation/", type: "docs" },
  ],
  "pcb-design": [{ title: "KiCad documentation (free PCB software)", url: "https://docs.kicad.org/", type: "docs" }],

  // Web & mobile
  javascript: [{ title: "The Modern JavaScript Tutorial", url: "https://javascript.info/", type: "course" }],
  react: [{ title: "Learn React (official)", url: "https://react.dev/learn", type: "docs" }],
  git: [{ title: "Pro Git book (free)", url: "https://git-scm.com/book/en/v2", type: "docs" }],
  typescript: [{ title: "TypeScript Handbook (official)", url: "https://www.typescriptlang.org/docs/handbook/intro.html", type: "docs" }],
  testing: [{ title: "Getting started with Jest", url: "https://jestjs.io/docs/getting-started", type: "docs" }],
  "html-css": [{ title: "Learn web development (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn", type: "course" }],
  nodejs: [{ title: "Learn Node.js (official)", url: "https://nodejs.org/en/learn", type: "docs" }],
  php: [{ title: "PHP: A simple tutorial (official manual)", url: "https://www.php.net/manual/en/tutorial.php", type: "docs" }],

  // Data
  "ms-excel": [{ title: "Excel tutorials (GCFGlobal)", url: "https://edu.gcfglobal.org/en/excel/", type: "course" }],
  sql: [{ title: "SQL Tutorial (W3Schools)", url: "https://www.w3schools.com/sql/", type: "course" }],
  python: [{ title: "The Python Tutorial (official)", url: "https://docs.python.org/3/tutorial/", type: "docs" }],
  "data-visualization": [{ title: "Data Visualization (Kaggle Learn)", url: "https://www.kaggle.com/learn/data-visualization", type: "course" }],
  "power-bi": [{ title: "Power BI documentation and training (Microsoft Learn)", url: "https://learn.microsoft.com/en-us/power-bi/", type: "docs" }],
  statistics: [{ title: "Statistics and probability (Khan Academy)", url: "https://www.khanacademy.org/math/statistics-probability", type: "course" }],

  // Design
  figma: [{ title: "Figma Help Center", url: "https://help.figma.com/hc/en-us", type: "docs" }],
  "user-research": [{ title: "UX Research Cheat Sheet (Nielsen Norman Group)", url: "https://www.nngroup.com/articles/ux-research-cheat-sheet/", type: "article" }],
  prototyping: [
    { title: "Guide to prototyping in Figma", url: "https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma", type: "docs" },
  ],
  canva: [{ title: "Canva Design School", url: "https://www.canva.com/designschool/", type: "course" }],
  photoshop: [{ title: "Photoshop tutorials (Adobe)", url: "https://helpx.adobe.com/photoshop/tutorials.html", type: "video" }],
  illustration: [{ title: "Drawabox (free drawing course)", url: "https://drawabox.com/", type: "course" }],

  // Business, marketing, communication
  communication: [{ title: "Work and career skills (GCFGlobal)", url: "https://edu.gcfglobal.org/en/subjects/work-and-career/", type: "course" }],
  sales: [{ title: "Free sales courses (HubSpot Academy)", url: "https://academy.hubspot.com/", type: "course" }],
  "crm-tools": [{ title: "Trailhead (free Salesforce CRM training)", url: "https://trailhead.salesforce.com/", type: "course" }],
  "social-media": [{ title: "Meta Business learning (free)", url: "https://www.facebook.com/business/learn", type: "course" }],
  copywriting: [{ title: "Copywriting 101 (Copyblogger)", url: "https://copyblogger.com/copywriting-101/", type: "article" }],
  "market-research": [
    { title: "Market research and competitive analysis (SBA)", url: "https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis", type: "article" },
  ],

  // Accounting and HR
  bookkeeping: [{ title: "Bookkeeping explained (AccountingCoach)", url: "https://www.accountingcoach.com/bookkeeping/explanation", type: "article" }],
  quickbooks: [{ title: "QuickBooks Learn & Support", url: "https://quickbooks.intuit.com/learn-support/en-us", type: "docs" }],
  "tax-basics": [{ title: "Bureau of Internal Revenue (official)", url: "https://www.bir.gov.ph/", type: "docs" }],
  recruitment: [{ title: "Hiring guides and templates (Workable)", url: "https://resources.workable.com/", type: "article" }],
  "labor-code-basics": [{ title: "Department of Labor and Employment (official)", url: "https://www.dole.gov.ph/", type: "docs" }],
  "payroll-basics": [{ title: "Payroll accounting explained (AccountingCoach)", url: "https://www.accountingcoach.com/payroll-accounting/explanation", type: "article" }],

  // Hospitality
  "customer-service": [{ title: "Customer service skills (Zendesk)", url: "https://www.zendesk.com/blog/customer-service-skills/", type: "article" }],
  english: [{ title: "LearnEnglish (British Council)", url: "https://learnenglish.britishcouncil.org/", type: "course" }],
  "food-safety": [{ title: "Five keys to safer food (WHO)", url: "https://www.who.int/publications/i/item/9789241594639", type: "article" }],

  // Engineering
  autocad: [{ title: "Autodesk learning (free tutorials)", url: "https://www.autodesk.com/learn", type: "course" }],
  "site-safety": [{ title: "Occupational Safety and Health Center (DOLE)", url: "https://oshc.dole.gov.ph/", type: "docs" }],
  sketchup: [{ title: "SketchUp Campus (free courses)", url: "https://learn.sketchup.com/", type: "course" }],

  // Communication & media
  photography: [{ title: "Photography tutorials (Cambridge in Colour)", url: "https://www.cambridgeincolour.com/tutorials.htm", type: "article" }],
  "video-editing": [
    { title: "DaVinci Resolve training (free)", url: "https://www.blackmagicdesign.com/products/davinciresolve/training", type: "video" },
  ],
};

/** Every resource with its stable id ("<skill>-1", "<skill>-2"). */
export const SKILL_RESOURCES: Record<string, LearningResource[]> = Object.fromEntries(
  Object.entries(LIST).map(([skill, list]) => [skill, list.map((r, i) => ({ ...r, id: `${skill}-${i + 1}` }))]),
);

export const ALL_RESOURCES: (LearningResource & { skillId: string })[] = Object.entries(SKILL_RESOURCES).flatMap(([skillId, list]) =>
  list.map((r) => ({ ...r, skillId })),
);

export function resourcesFor(skillId: string): LearningResource[] {
  return (SKILL_RESOURCES[skillId] ?? []).slice(0, 2);
}

export function findResource(id: string): (LearningResource & { skillId: string }) | null {
  return ALL_RESOURCES.find((r) => r.id === id) ?? null;
}
