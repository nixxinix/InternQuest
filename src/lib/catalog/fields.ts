/**
 * Fields = the classes from decision S3. A field drives the class/avatar
 * outfit, the "interests" part of the match score, and the Quick prep link.
 */

export const FIELDS = [
  { id: "iot", label: "IoT & Embedded", short: "IoT & Embedded" },
  { id: "web", label: "Web & Mobile Dev", short: "Web & Mobile" },
  { id: "data", label: "Data & Analytics", short: "Data" },
  { id: "design", label: "Design & Multimedia", short: "Design" },
  { id: "business", label: "Business & Marketing", short: "Business" },
  { id: "accounting", label: "Accounting & Finance", short: "Accounting" },
  { id: "hr", label: "HR & Admin", short: "HR & Admin" },
  { id: "hospitality", label: "Hospitality & Tourism", short: "Hospitality" },
  { id: "engineering", label: "Engineering (Civil, Mech, EE, ECE)", short: "Engineering" },
  { id: "comms", label: "Communication & Media", short: "Comms & Media" },
] as const;

export type FieldId = (typeof FIELDS)[number]["id"];

export function isFieldId(value: unknown): value is FieldId {
  return typeof value === "string" && FIELDS.some((f) => f.id === value);
}

export function fieldLabel(id: FieldId): string {
  return FIELDS.find((f) => f.id === id)?.label ?? id;
}
