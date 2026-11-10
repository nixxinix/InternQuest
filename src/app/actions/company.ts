"use server";

/**
 * Company server actions: register, log in and out, email confirmation, and
 * listing drafts (SPEC §12, §5.3). Every input is re-checked here; the form's
 * checks are only for quick feedback. A listing only reaches other people
 * once it's `status = 'published'`, which `publishListing` sets only after
 * the full check passes against the stored row (never the client's copy).
 */
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { isSkillId } from "@/lib/catalog/skills";
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, networkLabel, takeRateLimit } from "@/lib/auth/server";
import { validatePassword } from "@/lib/auth/validation";
import {
  draftToRow,
  publishDedupeKey,
  publishErrors,
  validateRegistrationInput,
  websiteHost,
  type PostingDraft,
  type StoredPosting,
} from "@/lib/company/account";
import { hashConfirmToken, makeConfirmToken } from "@/lib/company/tokens";
import { checkWebsiteLoads } from "@/lib/company/verify";
import { isEmailEnabled, sendEmail } from "@/lib/email/resend";
import { siteOrigin } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { manilaDate } from "@/lib/tracker/log";
import type { ActionResult } from "./auth";
import type { RegistrationErrors } from "@/lib/company/email";

const NOT_CONNECTED = "Accounts aren't connected in this preview yet.";
const SOMETHING_WRONG = "Something went wrong on our side. Try again in a minute.";
const NOT_SIGNED_IN = "You're signed out. Log in again, then retry.";
const NOT_YOURS = "That listing isn't yours, or doesn't exist any more.";
const isUniqueViolation = (code?: string) => code === "23505";

type Admin = ReturnType<typeof createServiceSupabase>;

/** The signed-in company's id and a couple of columns every action needs. */
async function signedInCompany(admin: Admin): Promise<{ id: string; name: string; workEmail: string; approved: boolean } | null> {
  const id = await currentUserId();
  if (!id) return null;
  const { data } = await admin.from("companies").select("id, name, work_email, status").eq("id", id).maybeSingle<{
    id: string;
    name: string;
    work_email: string;
    status: string;
  }>();
  return data ? { id: data.id, name: data.name, workEmail: data.work_email, approved: data.status === "approved" } : null;
}

async function setListingSkills(admin: Admin, listingId: string, skills: { id: string; required: boolean }[]) {
  await admin.from("internship_skills").delete().eq("internship_id", listingId);
  const valid = skills.filter((s) => isSkillId(s.id));
  if (valid.length) await admin.from("internship_skills").insert(valid.map((s) => ({ internship_id: listingId, skill_id: s.id, required: s.required })));
}

function confirmEmailText(companyName: string, token: string): string {
  const link = `${siteOrigin()}/api/companies/confirm?token=${token}`;
  return [
    `Hi ${companyName},`,
    "",
    "Confirm your InternQuest company email by opening this link. It's good for 7 days.",
    link,
    "",
    "If you didn't register on InternQuest, you can ignore this message.",
  ].join("\n");
}

/* ------------------------------------------------------------------------ */
/* Register, log in, log out                                                 */
/* ------------------------------------------------------------------------ */

export type RegisterResult =
  | { ok: true; signedIn: boolean; emailSent: boolean }
  | { ok: false; errors: RegistrationErrors & { password?: string; form?: string } };

export async function registerCompany(input: unknown): Promise<RegisterResult> {
  if (!isSupabaseConfigured()) return { ok: false, errors: { form: NOT_CONNECTED } };
  const errors = validateRegistrationInput(input);
  if (errors) return { ok: false, errors };
  const r = input as { companyName: string; website: string; email: string; role: string; registrationNo: string; password: string };
  const email = r.email.trim().toLowerCase();
  const password = String(r.password ?? "");
  const pw = validatePassword(password, email.split("@")[0] ?? "");
  if (!pw.ok) return { ok: false, errors: { password: pw.error } };

  if (!(await takeRateLimit("companySignup", await networkLabel()))) {
    return { ok: false, errors: { form: "Lots of new accounts from this network just now. Try again in an hour." } };
  }

  const admin = createServiceSupabase();
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, errors: { email: "An account with that email already exists." } };
    if (createError?.code === "weak_password") return { ok: false, errors: { password: "Pick a longer or less common password." } };
    console.error("[registerCompany] createUser failed:", createError?.code, createError?.message);
    return { ok: false, errors: { form: SOMETHING_WRONG } };
  }
  const id = created.user.id;
  const host = websiteHost(r.website);
  const name = r.companyName.trim().slice(0, 100);
  if (!host) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, errors: { website: "Add your company's website." } };
  }
  const website = `https://${host}`;

  const { error: companyError } = await admin.from("companies").insert({
    id,
    name,
    website,
    work_email: email,
    role: r.role.trim().slice(0, 60),
    registration_no: r.registrationNo.trim() ? r.registrationNo.trim().slice(0, 40) : null,
  });
  if (companyError) {
    await admin.auth.admin.deleteUser(id);
    if (isUniqueViolation(companyError.code)) return { ok: false, errors: { form: SOMETHING_WRONG } };
    console.error("[registerCompany] insert failed:", companyError.message);
    return { ok: false, errors: { form: SOMETHING_WRONG } };
  }

  // Best effort, after the account exists: check the website, and try to send a confirmation link.
  const websiteCheck = await checkWebsiteLoads(website);
  await admin.from("companies").update({ website_loads: websiteCheck.loads, website_checked_at: websiteCheck.checkedAt }).eq("id", id);

  let emailSent = false;
  if (isEmailEnabled()) {
    const token = makeConfirmToken();
    await admin.from("companies").update({ email_confirm_token: hashConfirmToken(token), email_confirm_sent_at: new Date().toISOString() }).eq("id", id);
    emailSent = (await sendEmail(email, "Confirm your InternQuest company email", confirmEmailText(name, token))).ok;
  }

  const supabase = await createServerSupabase();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) console.error("[registerCompany] sign-in after registration failed:", signInError.code, signInError.message);
  return { ok: true, signedIn: !signInError, emailSent };
}

export type CompanyLogInState = { error?: string; email?: string };

export async function companyLogIn(_prev: CompanyLogInState, form: FormData): Promise<CompanyLogInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Type your work email and password.", email };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED, email };
  if (password.length > 128) return { error: "That email and password don't match.", email };

  const [userOk, netOk] = await Promise.all([
    takeRateLimit("companyLogin", email),
    networkLabel().then((n) => takeRateLimit("companyLoginNetwork", n)),
  ]);
  if (!userOk || !netOk) return { error: TOO_MANY_TRIES, email };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) return { error: TOO_MANY_TRIES, email };
    return { error: "That email and password don't match.", email };
  }
  const { data: company } = await supabase.from("companies").select("id").eq("id", data.user.id).maybeSingle();
  if (!company) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This isn't a company account. Interns log in at /login.", email };
  }
  redirect("/companies/dashboard");
}

export async function companyLogOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/companies");
}

/** The link from the confirmation email. Looked up by an exact hash match, so a wrong token just finds nothing. */
export async function confirmCompanyEmail(token: string): Promise<boolean> {
  if (!isSupabaseConfigured() || typeof token !== "string" || !token) return false;
  const admin = createServiceSupabase();
  const { data } = await admin
    .from("companies")
    .select("id, email_confirm_sent_at")
    .eq("email_confirm_token", hashConfirmToken(token))
    .maybeSingle<{ id: string; email_confirm_sent_at: string | null }>();
  if (!data) return false;
  if (data.email_confirm_sent_at && Date.now() - new Date(data.email_confirm_sent_at).getTime() > 7 * 86_400_000) return false;
  await admin.from("companies").update({ email_confirmed: true, email_confirm_token: null }).eq("id", data.id);
  return true;
}

/** Resubmitting after a rejection: fix the details, go back to "pending" (SPEC §12 review). */
export async function updateCompanyDetails(input: {
  companyName: string;
  website: string;
  role: string;
  registrationNo: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const id = await currentUserId();
  if (!id) return { ok: false, error: NOT_SIGNED_IN };
  const name = String(input?.companyName ?? "").trim();
  if (name.length < 2 || name.length > 100) return { ok: false, error: "Add your company's name." };
  const host = websiteHost(String(input?.website ?? ""));
  if (!host) return { ok: false, error: "Add your company's website, like tanglaw.ph." };
  const role = String(input?.role ?? "").trim();
  if (!role || role.length > 60) return { ok: false, error: "Add your role, like HR Officer." };
  const registrationNo = String(input?.registrationNo ?? "").trim().slice(0, 40);

  const admin = createServiceSupabase();
  const { data: company } = await admin
    .from("companies")
    .select("status, name, website")
    .eq("id", id)
    .maybeSingle<{ status: string; name: string; website: string }>();
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  // An approved company's name and website are what we verified, and what the
  // Verified badge vouches for, so they can't change without a new review.
  if (company.status === "approved" && (name !== company.name || `https://${host}` !== company.website)) {
    return { ok: false, error: "Your company name and website were verified, so they can't be changed here." };
  }
  const { error } = await admin
    .from("companies")
    .update({
      name,
      website: `https://${host}`,
      role,
      registration_no: registrationNo || null,
      // A rejected company resubmits for review; an approved one is just updating its details.
      ...(company.status === "rejected" ? { status: "pending", reject_reason: null } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, error: SOMETHING_WRONG };
  return { ok: true };
}

/**
 * Deleting a company account (CLAUDE.md: users can delete their account and
 * data). Drafts are deleted; published listings are closed, not deleted, so
 * interns who saved or applied to them still see "This listing is closed" in
 * their quest log instead of a missing card. The listings keep the company's
 * name (it's public listing text) but no longer point to an account.
 */
export async function deleteCompanyAccount(typedEmail: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  if (String(typedEmail ?? "").trim().toLowerCase() !== company.workEmail.toLowerCase()) {
    return { ok: false, error: `Type ${company.workEmail} to confirm.` };
  }

  const { error: draftError } = await admin.from("internships").delete().eq("company_id", company.id).eq("status", "draft");
  const { error: closeError } = await admin
    .from("internships")
    .update({ status: "closed", is_active: false })
    .eq("company_id", company.id)
    .eq("status", "published");
  if (draftError || closeError) {
    console.error("[deleteCompanyAccount] listings:", draftError?.message, closeError?.message);
    return { ok: false, error: SOMETHING_WRONG };
  }
  // Removes the companies row too (ON DELETE CASCADE); listings are unlinked (ON DELETE SET NULL).
  const { error } = await admin.auth.admin.deleteUser(company.id);
  if (error) {
    console.error("[deleteCompanyAccount] failed:", error.message);
    return { ok: false, error: SOMETHING_WRONG };
  }
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/companies");
}

/* ------------------------------------------------------------------------ */
/* Listings                                                                   */
/* ------------------------------------------------------------------------ */

export async function saveListingDraft(draft: PostingDraft, listingId?: string): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };

  const today = manilaDate(new Date());
  const row = draftToRow(draft, today);
  if (typeof row === "string") return { ok: false, error: row };

  if (listingId) {
    const { data: existing } = await admin.from("internships").select("id").eq("id", listingId).eq("company_id", company.id).maybeSingle<{ id: string }>();
    if (!existing) return { ok: false, error: NOT_YOURS };
    const { error } = await admin.from("internships").update(row).eq("id", existing.id);
    if (error) return { ok: false, error: SOMETHING_WRONG };
    await setListingSkills(admin, existing.id, draft.skills);
    return { ok: true, id: existing.id };
  }

  const { count } = await admin.from("internships").select("id", { count: "exact", head: true }).eq("company_id", company.id);
  if ((count ?? 0) >= 200) return { ok: false, error: "You've reached the most listings one company can have. Close or delete an old one first." };

  const id = `d-${company.id.slice(0, 8)}-${randomBytes(4).toString("hex")}`;
  const { error } = await admin
    .from("internships")
    .insert({ id, company_id: company.id, company_name: company.name, source: "direct", status: "draft", dedupe_key: `draft:${id}`, ...row });
  if (error) {
    console.error("[saveListingDraft] insert failed:", error.message);
    return { ok: false, error: SOMETHING_WRONG };
  }
  await setListingSkills(admin, id, draft.skills);
  return { ok: true, id };
}

export async function publishListing(listingId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  if (!company.approved) return { ok: false, error: "Publishing opens once your company is approved." };

  const { data: listing } = await admin
    .from("internships")
    .select("title, field_id, snippet, area, work_type, apply_kind, apply_url, apply_email")
    .eq("id", String(listingId ?? ""))
    .eq("company_id", company.id)
    .maybeSingle<StoredPosting>();
  if (!listing) return { ok: false, error: NOT_YOURS };
  const errors = publishErrors(listing, company.workEmail);
  if (errors.length) return { ok: false, error: errors.length === 1 ? errors[0] : `${errors[0]} (and ${errors.length - 1} more)` };

  const dedupe = publishDedupeKey(company.name, listing.title, listing.area, listing.work_type === "remote");
  const publish = () =>
    admin
      .from("internships")
      .update({ status: "published", verified: true, is_active: true, dedupe_key: dedupe, posted_at: new Date().toISOString() })
      .eq("id", listingId);

  let { error } = await publish();
  if (error && isUniqueViolation(error.code)) {
    // Someone already holds this company + title + city. If it's an
    // aggregator copy of the same job, the company's own post wins (decision
    // #130): the copy is hidden and given up its key, so the daily import
    // treats it as superseded from now on.
    const { data: holder } = await admin
      .from("internships")
      .select("id, source, company_id")
      .eq("dedupe_key", dedupe)
      .maybeSingle<{ id: string; source: string; company_id: string | null }>();
    if (holder && holder.source !== "direct" && holder.source !== "admin" && !holder.company_id) {
      await admin.from("internships").update({ is_active: false, dedupe_key: `superseded:${holder.id}` }).eq("id", holder.id);
      ({ error } = await publish());
    } else {
      return { ok: false, error: "You already have a listing with this title and city. Edit that one instead of making a new one." };
    }
  }
  return error ? { ok: false, error: SOMETHING_WRONG } : { ok: true };
}

export async function closeListing(listingId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  const { data } = await admin
    .from("internships")
    .update({ is_active: false, status: "closed" })
    .eq("id", String(listingId ?? ""))
    .eq("company_id", company.id)
    .eq("status", "published")
    .select("id");
  if (!data?.length) return { ok: false, error: NOT_YOURS };
  return { ok: true };
}

/** Puts a closed listing back as published, for "Post again" in the dashboard. */
export async function reopenListing(listingId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  if (!company.approved) return { ok: false, error: "Publishing opens once your company is approved." };
  const { data: listing } = await admin
    .from("internships")
    .select("title, field_id, snippet, area, work_type, apply_kind, apply_url, apply_email")
    .eq("id", String(listingId ?? ""))
    .eq("company_id", company.id)
    .eq("status", "closed")
    .maybeSingle<StoredPosting>();
  if (!listing) return { ok: false, error: NOT_YOURS };
  const errors = publishErrors(listing, company.workEmail);
  if (errors.length) return { ok: false, error: "Edit the listing first: some details are missing or out of date." };
  const { error } = await admin
    .from("internships")
    .update({ status: "published", is_active: true, posted_at: new Date().toISOString() })
    .eq("id", listingId);
  return error ? { ok: false, error: SOMETHING_WRONG } : { ok: true };
}

export async function deleteDraft(listingId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONNECTED };
  const admin = createServiceSupabase();
  const company = await signedInCompany(admin);
  if (!company) return { ok: false, error: NOT_SIGNED_IN };
  const { data } = await admin
    .from("internships")
    .delete()
    .eq("id", String(listingId ?? ""))
    .eq("company_id", company.id)
    .eq("status", "draft")
    .select("id");
  if (!data?.length) return { ok: false, error: NOT_YOURS };
  return { ok: true };
}
