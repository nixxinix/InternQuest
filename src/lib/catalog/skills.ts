/**
 * Skills catalog (sample for design and Phase 1 seeding).
 * In the database this becomes the `skills` and `skill_synonyms` tables.
 */
import type { FieldId } from "./fields";

export type Skill = {
  id: string;
  name: string;
  fields: FieldId[];
  /** Extra words people search for. Search only, they don't change scoring. */
  aliases?: string[];
};

export const SKILLS: Skill[] = [
  // IoT & Embedded
  { id: "arduino", name: "Arduino", fields: ["iot"] },
  { id: "c", name: "C", fields: ["iot", "engineering"], aliases: ["c programming"] },
  { id: "sensors", name: "Sensors", fields: ["iot"] },
  { id: "soldering", name: "Soldering", fields: ["iot", "engineering"] },
  { id: "mqtt", name: "MQTT", fields: ["iot"] },
  { id: "iot", name: "IoT", fields: ["iot"], aliases: ["internet of things"] },
  { id: "embedded-systems", name: "Embedded systems", fields: ["iot"] },
  { id: "raspberry-pi", name: "Raspberry Pi", fields: ["iot"] },
  { id: "pcb-design", name: "PCB design", fields: ["iot", "engineering"] },
  // Web & Mobile
  { id: "javascript", name: "JavaScript", fields: ["web"], aliases: ["js"] },
  { id: "react", name: "React", fields: ["web"], aliases: ["reactjs"] },
  { id: "git", name: "Git", fields: ["web", "data"], aliases: ["github"] },
  { id: "typescript", name: "TypeScript", fields: ["web"], aliases: ["ts"] },
  { id: "testing", name: "Testing", fields: ["web"], aliases: ["qa", "quality assurance"] },
  { id: "html-css", name: "HTML & CSS", fields: ["web", "design"] },
  { id: "nodejs", name: "Node.js", fields: ["web"] },
  { id: "php", name: "PHP", fields: ["web"] },
  // Data
  { id: "ms-excel", name: "MS Excel", fields: ["data", "accounting", "business", "hr"], aliases: ["excel", "spreadsheets"] },
  { id: "sql", name: "SQL", fields: ["data", "web"] },
  { id: "python", name: "Python", fields: ["data", "web", "iot"] },
  { id: "data-visualization", name: "Data visualization", fields: ["data"], aliases: ["charts", "dashboards"] },
  { id: "power-bi", name: "Power BI", fields: ["data"] },
  { id: "statistics", name: "Statistics", fields: ["data"] },
  // Design
  { id: "figma", name: "Figma", fields: ["design"] },
  { id: "user-research", name: "User research", fields: ["design"], aliases: ["ux research"] },
  { id: "prototyping", name: "Prototyping", fields: ["design"] },
  { id: "canva", name: "Canva", fields: ["design", "comms", "business"] },
  { id: "photoshop", name: "Photoshop", fields: ["design", "comms"] },
  { id: "illustration", name: "Illustration", fields: ["design"] },
  // Business & Marketing
  { id: "communication", name: "Communication", fields: ["business", "hr", "hospitality", "comms"] },
  { id: "sales", name: "Sales", fields: ["business"] },
  { id: "crm-tools", name: "CRM tools", fields: ["business"], aliases: ["hubspot", "salesforce"] },
  { id: "social-media", name: "Social media", fields: ["business", "comms"] },
  { id: "copywriting", name: "Copywriting", fields: ["comms", "business"], aliases: ["writing"] },
  { id: "market-research", name: "Market research", fields: ["business"] },
  // Accounting & Finance
  { id: "bookkeeping", name: "Bookkeeping", fields: ["accounting"] },
  { id: "quickbooks", name: "QuickBooks", fields: ["accounting"] },
  { id: "tax-basics", name: "Tax basics", fields: ["accounting"], aliases: ["bir"] },
  // HR & Admin
  { id: "recruitment", name: "Recruitment", fields: ["hr"], aliases: ["hiring"] },
  { id: "labor-code-basics", name: "Labor Code basics", fields: ["hr"] },
  { id: "payroll-basics", name: "Payroll basics", fields: ["hr", "accounting"] },
  // Hospitality & Tourism
  { id: "customer-service", name: "Customer service", fields: ["hospitality", "business"], aliases: ["guest relations"] },
  { id: "reservations-systems", name: "Reservations systems", fields: ["hospitality"] },
  { id: "english", name: "English (spoken)", fields: ["hospitality", "comms"] },
  { id: "food-safety", name: "Food safety", fields: ["hospitality"] },
  // Engineering
  { id: "autocad", name: "AutoCAD", fields: ["engineering"] },
  { id: "construction-estimating", name: "Construction estimating", fields: ["engineering"] },
  { id: "site-safety", name: "Site safety", fields: ["engineering"] },
  { id: "sketchup", name: "SketchUp", fields: ["engineering", "design"] },
  // Communication & Media
  { id: "photography", name: "Photography", fields: ["comms"] },
  { id: "video-editing", name: "Video editing", fields: ["comms", "design"] },
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function isSkillId(id: string): boolean {
  return BY_ID.has(id);
}

export function skillName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

/**
 * Synonym groups for scoring (SPEC §7): skills in one group count as the
 * same skill. The first id in a group is the canonical one.
 */
export const SYNONYM_GROUPS: string[][] = [["embedded-systems", "iot"]];

const CANONICAL = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  for (const id of group) CANONICAL.set(id, group[0]);
}

/** Maps a skill id to its canonical id, so synonyms match each other. */
export function canonicalSkill(id: string): string {
  return CANONICAL.get(id) ?? id;
}

/** Skills for a field, in catalog order. */
export function skillsForField(field: FieldId): Skill[] {
  return SKILLS.filter((s) => s.fields.includes(field));
}

/** Shown before a field is picked: one common skill from most fields. */
export const STARTER_SKILLS = [
  "javascript",
  "python",
  "ms-excel",
  "communication",
  "figma",
  "arduino",
  "customer-service",
  "autocad",
  "social-media",
  "bookkeeping",
];

/** Case-insensitive search over names and aliases. */
export function searchSkills(query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return SKILLS;
  return SKILLS.filter(
    (s) => s.name.toLowerCase().includes(q) || s.aliases?.some((a) => a.toLowerCase().includes(q)),
  );
}
