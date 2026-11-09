/**
 * A visitor's picks (field, skills, city, remote) live in the URL so links
 * can be shared and Back works. One parser for every page that reads them.
 */
import { findCityById, type City } from "@/lib/catalog/cities";
import { isFieldId, type FieldId } from "@/lib/catalog/fields";
import { isSkillId } from "@/lib/catalog/skills";

export const MAX_SKILLS = 10;

export type Picks = {
  field: FieldId | null;
  skills: string[];
  city: City | null;
  remoteOk: boolean;
};

type ParamsLike = { get(name: string): string | null };

export function readPicks(params: ParamsLike): Picks {
  const field = params.get("field");
  return {
    field: isFieldId(field) ? field : null,
    skills: (params.get("skills") ?? "")
      .split(",")
      .filter((s, i, all) => s && isSkillId(s) && all.indexOf(s) === i)
      .slice(0, MAX_SKILLS),
    city: findCityById(params.get("city")),
    remoteOk: params.get("remote") !== "0",
  };
}

/** Builds the query string for a set of picks (no leading "?"). Defaults are left out. */
export function picksQuery(picks: Picks): string {
  const q = new URLSearchParams();
  if (picks.field) q.set("field", picks.field);
  if (picks.skills.length) q.set("skills", picks.skills.join(","));
  if (picks.city) q.set("city", picks.city.id);
  if (!picks.remoteOk) q.set("remote", "0");
  return q.toString();
}

export function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}
