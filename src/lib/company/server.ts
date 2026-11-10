import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { currentUserId } from "@/lib/auth/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { companyFromRow, postingFromRow, type Company, type CompanyPosting, type CompanyRow, type PostingRow } from "./account";

const COMPANY_COLUMNS =
  "id,name,website,work_email,role,registration_no,status,reject_reason,email_confirmed,website_loads,website_checked_at,created_at";

/** The signed-in company, or null when nobody is signed in as a company. Cached for one request. */
export const getCompany = cache(async (): Promise<Company | null> => {
  await connection();
  const id = await currentUserId();
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle<CompanyRow>();
  if (error) throw new Error(`Couldn't load the company: ${error.message}`);
  return data ? companyFromRow(data) : null;
});

/**
 * One specific listing, owned by the given company (for the edit form).
 * Companies have no RLS read access to internships (all their reads and
 * writes go through service-role server code after an ownership check, the
 * same pattern as the quest log); `companyId` must already be the verified
 * signed-in company's id, never a value taken from the request.
 */
export async function getCompanyPosting(companyId: string, listingId: string) {
  const admin = createServiceSupabase();
  const { data } = await admin
    .from("internships")
    .select(
      "id, title, field_id, snippet, area, work_type, allowance, hours, moa, deadline, start_date, apply_kind, apply_url, apply_email, status, internship_skills(skill_id, required)",
    )
    .eq("id", listingId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data ?? null;
}

/** Every listing a company owns, for the dashboard, with apply-click totals. */
export async function getCompanyListings(companyId: string): Promise<CompanyPosting[]> {
  const admin = createServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await admin
    .from("internships")
    .select("id, title, status, is_active, deadline, updated_at, created_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .overrideTypes<PostingRow[], { merge: false }>();
  if (error) throw new Error(`Couldn't load your listings: ${error.message}`);
  if (!rows?.length) return [];

  const { data: clicks } = await admin.from("click_logs").select("internship_id").in(
    "internship_id",
    rows.map((r) => r.id),
  );
  const counts = new Map<string, number>();
  for (const c of (clicks ?? []) as { internship_id: string }[]) counts.set(c.internship_id, (counts.get(c.internship_id) ?? 0) + 1);

  return rows.map((row) => postingFromRow(row, counts.get(row.id) ?? 0, today));
}
