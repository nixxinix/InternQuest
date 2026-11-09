/**
 * SAMPLE `skill_resources` (SPEC §6): 1 to 2 free learning links per skill.
 * Only well-known, free, official or long-running sources. Before launch the
 * admin should open every link once, because sites move pages around.
 */
import type { LearningResource } from "@/lib/listings/types";

export const SKILL_RESOURCES: Record<string, LearningResource[]> = {
  mqtt: [{ title: "MQTT Essentials (HiveMQ)", url: "https://www.hivemq.com/mqtt/mqtt-essentials/", type: "article" }],
  c: [{ title: "Learn C (interactive tutorial)", url: "https://www.learn-c.org/", type: "course" }],
  arduino: [{ title: "Arduino documentation", url: "https://docs.arduino.cc/", type: "docs" }],
  javascript: [{ title: "The Modern JavaScript Tutorial", url: "https://javascript.info/", type: "course" }],
  react: [{ title: "Learn React (official)", url: "https://react.dev/learn", type: "docs" }],
  typescript: [
    { title: "TypeScript Handbook (official)", url: "https://www.typescriptlang.org/docs/handbook/intro.html", type: "docs" },
  ],
  git: [{ title: "Pro Git book (free)", url: "https://git-scm.com/book/en/v2", type: "docs" }],
  python: [{ title: "The Python Tutorial (official)", url: "https://docs.python.org/3/tutorial/", type: "docs" }],
  sql: [{ title: "SQL Tutorial (W3Schools)", url: "https://www.w3schools.com/sql/", type: "course" }],
  "ms-excel": [{ title: "Excel tutorials (GCFGlobal)", url: "https://edu.gcfglobal.org/en/excel/", type: "course" }],
  figma: [{ title: "Figma Help Center", url: "https://help.figma.com/hc/en-us", type: "docs" }],
  canva: [{ title: "Canva Design School", url: "https://www.canva.com/designschool/", type: "course" }],
};

export function resourcesFor(skillId: string): LearningResource[] {
  return (SKILL_RESOURCES[skillId] ?? []).slice(0, 2);
}
