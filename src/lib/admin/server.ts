import "server-only";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/server";
import type { CompanyRow } from "@/lib/company/account";
import { checkWebsiteLoads } from "@/lib/company/verify";
import { createServiceSupabase } from "@/lib/supabase/server";
import { companyRowToItem, flagRowToItem, groupReportsForListing, type FlagRow, type ReportedListing, type ReportRow } from "./rows";
import type { AuditEntry, QueueItem, QueueKind } from "./queue";

/* ------------------------------------------------------------------------ */
/* Who is an admin                                                           */
/* ------------------------------------------------------------------------ */

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await createServiceSupabase().from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return data !== null;
}

export type Admin = { id: string; label: string };

export async function currentAdmin(): Promise<Admin | null> {
  const id = await currentUserId();
  if (!id || !(await isAdmin(id))) return null;
  const admin = createServiceSupabase();
  const [profile, company] = await Promise.all([
    admin.from("profiles").select("username").eq("id", id).maybeSingle<{ username: string }>(),
    admin.from("companies").select("name").eq("id", id).maybeSingle<{ name: string }>(),
  ]);
  return { id, label: profile.data?.username ?? company.data?.name ?? `admin-${id.slice(0, 8)}` };
}

/** For admin pages: sends anyone who isn't an admin to log in first. */
export async function requireAdmin(page: "/admin" | "/admin/import" = "/admin"): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect(`/login?next=${encodeURIComponent(page)}`);
  return admin;
}

/* ------------------------------------------------------------------------ */
/* Loading the queue                                                         */
/* ------------------------------------------------------------------------ */

const db = () => createServiceSupabase();

export async function loadQueue(): Promise<{ items: QueueItem[]; audit: AuditEntry[] }> {
  const admin = db();
  const now = new Date();
  const [companies, reports, flags, audit] = await Promise.all([
    admin
      .from("companies")
      .select("id,name,website,work_email,role,registration_no,status,reject_reason,email_confirmed,website_loads,website_checked_at,created_at")
      .eq("status", "pending")
      .order("created_at")
      .overrideTypes<CompanyRow[], { merge: false }>(),
    admin.from("reports").select("id,internship_id,reason,note,created_at").is("resolved_at", null).order("created_at").overrideTypes<ReportRow[], { merge: false }>(),
    admin
      .from("activity_flags")
      .select("id,user_id,reason,created_at,window_start,window_end")
      .is("resolved_at", null)
      .order("created_at")
      .overrideTypes<FlagRow[], { merge: false }>(),
    admin.from("admin_audit").select("created_at,admin_label,kind,item_id,subject,action,reason").order("created_at", { ascending: false }).limit(50),
  ]);

  const items: QueueItem[] = [];

  if (companies.data?.length) {
    const ids = companies.data.map((c) => c.id);
    const { data: drafts } = await admin.from("internships").select("company_id").in("company_id", ids).eq("status", "draft");
    const draftCounts = new Map<string, number>();
    for (const d of (drafts ?? []) as { company_id: string }[]) draftCounts.set(d.company_id, (draftCounts.get(d.company_id) ?? 0) + 1);
    for (const row of companies.data) items.push(companyRowToItem(row, draftCounts.get(row.id) ?? 0, now));
  }

  if (reports.data?.length) {
    const listingIds = [...new Set(reports.data.map((r) => r.internship_id))];
    const { data: listings } = await admin.from("internships").select("id, title, company_name, snippet").in("id", listingIds);
    const byListing = new Map(
      (listings ?? []).map((l: { id: string; title: string; company_name: string; snippet: string | null }) => [
        l.id,
        { title: l.title, company: l.company_name, snippet: l.snippet ?? "" } satisfies ReportedListing,
      ]),
    );
    const grouped = new Map<string, ReportRow[]>();
    for (const r of reports.data) grouped.set(r.internship_id, [...(grouped.get(r.internship_id) ?? []), r]);
    for (const [listingId, group] of grouped) {
      const listing = byListing.get(listingId);
      if (listing) items.push(groupReportsForListing(listingId, group, listing, now));
    }
  }

  if (flags.data?.length) {
    const userIds = [...new Set(flags.data.map((f) => f.user_id))];
    const { data: profiles } = await admin.from("profiles").select("id, username").in("id", userIds);
    const names = new Map((profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
    for (const row of flags.data) {
      const username = names.get(row.user_id) ?? "(deleted account)";
      let expAtStake = 0;
      if (row.window_start && row.window_end) {
        const { data: events } = await admin
          .from("exp_events")
          .select("amount")
          .eq("user_id", row.user_id)
          .eq("kind", "confirm")
          .gte("created_at", row.window_start)
          .lte("created_at", row.window_end);
        expAtStake = (events ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0);
      }
      items.push(flagRowToItem(row, username, expAtStake, now));
    }
  }

  const auditEntries: AuditEntry[] = (audit.data ?? []).map((a) => ({
    at: a.created_at as string,
    admin: a.admin_label as string,
    kind: a.kind as QueueKind,
    itemId: a.item_id as string,
    subject: a.subject as string,
    action: a.action as string,
    reason: a.reason as string,
  }));

  return { items, audit: auditEntries };
}

/* ------------------------------------------------------------------------ */
/* Loading one item (for a decision)                                         */
/* ------------------------------------------------------------------------ */

export async function loadCompanyItem(companyId: string): Promise<QueueItem | null> {
  const admin = db();
  const { data } = await admin
    .from("companies")
    .select("id,name,website,work_email,role,registration_no,status,reject_reason,email_confirmed,website_loads,website_checked_at,created_at")
    .eq("id", companyId)
    .eq("status", "pending")
    .maybeSingle<CompanyRow>();
  if (!data) return null;
  const { count } = await admin.from("internships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "draft");
  return companyRowToItem(data, count ?? 0, new Date());
}

export async function loadReportItem(internshipId: string): Promise<QueueItem | null> {
  const admin = db();
  const [{ data: rows }, { data: listing }] = await Promise.all([
    admin.from("reports").select("id,internship_id,reason,note,created_at").eq("internship_id", internshipId).is("resolved_at", null),
    admin.from("internships").select("title, company_name, snippet").eq("id", internshipId).maybeSingle<{ title: string; company_name: string; snippet: string | null }>(),
  ]);
  if (!rows?.length || !listing) return null;
  return groupReportsForListing(
    internshipId,
    rows as ReportRow[],
    { title: listing.title, company: listing.company_name, snippet: listing.snippet ?? "" },
    new Date(),
  );
}

export async function loadFlagItem(flagId: number): Promise<QueueItem | null> {
  const admin = db();
  const { data: row } = await admin
    .from("activity_flags")
    .select("id,user_id,reason,created_at,window_start,window_end")
    .eq("id", flagId)
    .is("resolved_at", null)
    .maybeSingle<FlagRow>();
  if (!row) return null;
  const { data: profile } = await admin.from("profiles").select("username").eq("id", row.user_id).maybeSingle<{ username: string }>();
  let expAtStake = 0;
  if (row.window_start && row.window_end) {
    const { data: events } = await admin
      .from("exp_events")
      .select("amount")
      .eq("user_id", row.user_id)
      .eq("kind", "confirm")
      .gte("created_at", row.window_start)
      .lte("created_at", row.window_end);
    expAtStake = (events ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0);
  }
  return flagRowToItem(row, profile?.username ?? "(deleted account)", expAtStake, new Date());
}

/* ------------------------------------------------------------------------ */
/* Applying a decision                                                       */
/* ------------------------------------------------------------------------ */

export async function writeAudit(admin: Admin, entry: Omit<AuditEntry, "at" | "admin">): Promise<void> {
  const { error } = await db().from("admin_audit").insert({
    admin_id: admin.id,
    admin_label: admin.label,
    kind: entry.kind,
    item_id: entry.itemId,
    subject: entry.subject,
    action: entry.action,
    reason: entry.reason,
  });
  if (error) console.error("[admin] couldn't write the audit log:", error.message);
}

export async function approveCompany(companyId: string): Promise<boolean> {
  const { data } = await db()
    .from("companies")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", companyId)
    .eq("status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function rejectCompany(companyId: string, reason: string): Promise<boolean> {
  const { data } = await db()
    .from("companies")
    .update({ status: "rejected", reject_reason: reason.slice(0, 200) })
    .eq("id", companyId)
    .eq("status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

/** Hides one listing and resolves every open report for it. */
export async function hideListing(internshipId: string, resolution: string): Promise<void> {
  const admin = db();
  await admin.from("internships").update({ is_active: false }).eq("id", internshipId);
  await admin
    .from("reports")
    .update({ resolved_at: new Date().toISOString(), resolution: resolution.slice(0, 60) })
    .eq("internship_id", internshipId)
    .is("resolved_at", null);
}

export async function dismissReports(internshipId: string, resolution: string): Promise<void> {
  await db()
    .from("reports")
    .update({ resolved_at: new Date().toISOString(), resolution: resolution.slice(0, 60) })
    .eq("internship_id", internshipId)
    .is("resolved_at", null);
}

/** Bans the company's sign-in, hides their published listings, and resolves reports tied to this item's listing. */
export async function suspendCompanyFromReport(internshipId: string): Promise<void> {
  const admin = db();
  const { data: listing } = await admin.from("internships").select("company_id").eq("id", internshipId).maybeSingle<{ company_id: string | null }>();
  if (listing?.company_id) await suspendCompany(listing.company_id);
  await dismissReports(internshipId, "Company suspended");
}

export async function suspendCompany(companyId: string): Promise<void> {
  const admin = db();
  await admin.from("companies").update({ status: "suspended", suspended_at: new Date().toISOString() }).eq("id", companyId);
  await admin.from("internships").update({ is_active: false }).eq("company_id", companyId).eq("status", "published");
  const { error } = await admin.auth.admin.updateUserById(companyId, { ban_duration: "87600h" });
  if (error) console.error("[admin] couldn't lock the company's sign-in:", error.message);
}

export async function clearFlag(flagId: number): Promise<void> {
  await db().from("activity_flags").update({ resolved_at: new Date().toISOString() }).eq("id", flagId);
}

/** Removes exactly the EXP earned in the flagged window, and resolves the flag. */
export async function reverseExpForFlag(flagId: number, userId: string, windowStart: string | null, windowEnd: string | null): Promise<void> {
  const admin = db();
  if (windowStart && windowEnd) {
    await admin.from("exp_events").delete().eq("user_id", userId).eq("kind", "confirm").gte("created_at", windowStart).lte("created_at", windowEnd);
  }
  await admin.from("activity_flags").update({ resolved_at: new Date().toISOString() }).eq("id", flagId);
}

export async function suspendUserFromFlag(flagId: number, userId: string): Promise<void> {
  const admin = db();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "87600h" });
  if (error) console.error("[admin] couldn't lock the user's sign-in:", error.message);
  await admin.from("activity_flags").update({ resolved_at: new Date().toISOString() }).eq("id", flagId);
}

/** Admin "Recheck" on a pending company's website. */
export async function recheckCompanyWebsite(companyId: string): Promise<boolean | null> {
  const { data: company } = await db().from("companies").select("website").eq("id", companyId).maybeSingle<{ website: string }>();
  if (!company) return null;
  const result = await checkWebsiteLoads(company.website);
  await db().from("companies").update({ website_loads: result.loads, website_checked_at: result.checkedAt }).eq("id", companyId);
  return result.loads;
}
