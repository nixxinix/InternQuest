/**
 * The profile ("character sheet") fields and their rules. Shared by
 * onboarding (step 4) and Profile > Edit, and (Phase 1) re-checked on the server.
 */
import { findCityByName } from "@/lib/catalog/cities";
import type { FieldId } from "@/lib/catalog/fields";
import type { WorkType } from "@/lib/listings/types";

export type ProfileValues = {
  look: { skin: string; hair: string };
  field: FieldId | null;
  skills: string[];
  cityId: string | null;
  workType: WorkType | null;
  status: string | null;
  school: string | null;
};

export type ProfileErrors = Partial<Record<"field" | "skills" | "city", string>>;

/** `cityText` is what's typed in the box; an unknown place is an error, an empty box is fine. */
export function profileErrors(values: ProfileValues, cityText: string): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!values.field) errors.field = "Pick the field closest to what you study or want to do.";
  if (values.skills.length === 0) errors.skills = "Pick at least one. Even a little experience counts.";
  if (cityText.trim() && !findCityByName(cityText)) {
    errors.city = "We don't know that place yet. Try a city name, like Quezon City, or leave it empty.";
  }
  return errors;
}
