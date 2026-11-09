/**
 * The profile ("character sheet") fields and their rules. Shared by
 * onboarding (step 4) and Profile > Edit, and re-checked on the server
 * (src/lib/account/account.ts).
 */
import { findCityByName } from "@/lib/catalog/cities";
import type { FieldId } from "@/lib/catalog/fields";
import type { WorkType } from "@/lib/listings/types";
import { isPlaceQuery } from "@/lib/geo/nominatim";

export type ProfileValues = {
  look: { skin: string; hair: string };
  field: FieldId | null;
  skills: string[];
  /** A catalog city id, or a found place ("@lat,lng:Name", see src/lib/catalog/cities.ts). */
  cityId: string | null;
  workType: WorkType | null;
  status: string | null;
  school: string | null;
};

export type ProfileErrors = Partial<Record<"field" | "skills" | "city", string>>;

/**
 * `cityText` is what's typed in the box; an empty box is fine.
 * `anyPlace`: with accounts connected, any city or town can be typed (the
 * server looks it up on the map when saving). In the design preview only
 * places on our list work.
 */
export function profileErrors(values: ProfileValues, cityText: string, { anyPlace = false } = {}): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!values.field) errors.field = "Pick the field closest to what you study or want to do.";
  if (values.skills.length === 0) errors.skills = "Pick at least one. Even a little experience counts.";
  const text = cityText.trim();
  if (text) {
    if (anyPlace) {
      if (!isPlaceQuery(text)) errors.city = "Type a city or town name, like Antipolo, or leave it empty.";
    } else if (!findCityByName(text)) {
      errors.city = "We don't know that place yet. Try a city name, like Quezon City, or leave it empty.";
    }
  }
  return errors;
}
