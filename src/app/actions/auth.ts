"use server";

/**
 * Account server actions: sign up, log in and out, recovery, and the account
 * changes in Settings. Every input is re-checked here (the form's checks are
 * only for quick feedback). Errors never say whether a username exists,
 * except where the form must (availability while signing up, which is
 * rate-limited and public anyway on the leaderboard).
 */
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { internalEmail } from "@/lib/auth/identity";
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { isRecoveryCode, isValidCodeSet } from "@/lib/auth/recovery";
import { safeNext } from "@/lib/auth/routes";
import { hashRecoveryCode, verifyRecoveryCode } from "@/lib/auth/secrets";
import { currentUserId, networkLabel, takeRateLimit } from "@/lib/auth/server";
import { validateSignUp, type SignUpErrors, type SignUpInput } from "@/lib/auth/signup";
import { RESERVED_USERNAMES, normalizeUsername, suggestUsernames, validatePassword, validateUsername } from "@/lib/auth/validation";
import { canConfirmDelete } from "@/lib/settings/settings";
import { isSupabaseConfigured, requireSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const NOT_CONNECTED = "Accounts aren't connected in this preview yet.";
const SOMETHING_WRONG = "Something went wrong on our side. Try again in a minute.";
const NOT_SIGNED_IN = "You're signed out. Log in again, then retry.";
const LOGIN_MISMATCH = "That username and password don't match.";
const RECOVERY_MISMATCH = "That username and recovery code don't match.";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

/** Duplicate username at the database level (unique index). */
const isUniqueViolation = (code?: string) => code === "23505";

/* ------------------------------------------------------------------------ */
/* Sign up (onboarding step 1)                                               */
/* ------------------------------------------------------------------------ */

export type SignUpResult = { ok: true; signedIn: boolean } | { ok: false; errors: SignUpErrors };

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  if (!isSupabaseConfigured()) return { ok: false, errors: { form: NOT_CONNECTED } };
  const check = validateSignUp({
    username: String(input?.username ?? ""),
    password: String(input?.password ?? ""),
    consent: input?.consent === true,
    ageOk: input?.ageOk === true,
  });
  if (!check.ok) return { ok: false, errors: check.errors };
  const { username, password } = check;

  if (!(await takeRateLimit("signup", await networkLabel()))) {
    return { ok: false, errors: { form: "Lots of new accounts from this network just now. Try again in an hour." } };
  }

  const admin = createServiceSupabase();
  const { data: free, error: freeError } = await admin.rpc("username_available", { name: username });
  if (freeError) return { ok: false, errors: { form: SOMETHING_WRONG } };
  if (free === false) return { ok: false, errors: { username: "That one's taken." } };

  const email = internalEmail(username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, errors: { username: "That one's taken." } };
    if (createError?.code === "weak_password") return { ok: false, errors: { password: "Pick a longer or less common password." } };
    console.error("[signUp] createUser failed:", createError?.code, createError?.message);
    return { ok: false, errors: { form: SOMETHING_WRONG } };
  }
  const id = created.user.id;

  // The profile records consent and the age confirmation. If anything fails, the
  // half-made account is removed so the username isn't stuck.
  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id, username, consented_at: now, age_confirmed_at: now });
  const { error: settingsError } = profileError ? { error: null } : await admin.from("user_settings").insert({ user_id: id });
  if (profileError || settingsError) {
    await admin.auth.admin.deleteUser(id);
    if (isUniqueViolation(profileError?.code)) return { ok: false, errors: { username: "That one's taken." } };
    console.error("[signUp] profile setup failed:", (profileError ?? settingsError)?.message);
    return { ok: false, errors: { form: SOMETHING_WRONG } };
  }

  const supabase = await createServerSupabase();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) console.error("[signUp] sign-in after sign-up failed:", signInError.code, signInError.message);
  return { ok: true, signedIn: !signInError };
}

/* ------------------------------------------------------------------------ */
/* Username availability (as you type)                                       */
/* ------------------------------------------------------------------------ */

export type UsernameAvailability = { ok: true; available: boolean; suggestions: string[] } | { ok: false; error: string };

export async function checkUsername(raw: string): Promise<UsernameAvailability> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const check = validateUsername(String(raw ?? ""));
  if (!check.ok) return fail(check.error);
  if (!(await takeRateLimit("usernameCheck", await networkLabel()))) return fail(TOO_MANY_TRIES);

  // One query covers the name and the alternatives we might suggest.
  const base = check.value;
  const candidates = [base, ...suggestUsernames(base, () => false, 10)];
  const { data, error } = await createServiceSupabase().from("profiles").select("username").in("username", candidates);
  if (error) return fail(SOMETHING_WRONG);
  const taken = new Set((data ?? []).map((r: { username: string }) => r.username));
  const isTaken = (u: string) => taken.has(u) || RESERVED_USERNAMES.has(u);
  const available = !isTaken(base);
  return { ok: true, available, suggestions: available ? [] : suggestUsernames(base, isTaken) };
}

/* ------------------------------------------------------------------------ */
/* Log in and out                                                            */
/* ------------------------------------------------------------------------ */

export type LogInState = { error?: string; username?: string };

export async function logIn(_prev: LogInState, form: FormData): Promise<LogInState> {
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!username || !password) return { error: "Type your username and password.", username };
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED, username };
  // A name that can't exist can't log in. Same message as a wrong password.
  if (!validateUsername(username).ok || password.length > 128) return { error: LOGIN_MISMATCH, username };

  const [userOk, netOk] = await Promise.all([
    takeRateLimit("login", username),
    networkLabel().then((n) => takeRateLimit("loginNetwork", n)),
  ]);
  if (!userOk || !netOk) return { error: TOO_MANY_TRIES, username };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: internalEmail(username), password });
  if (error || !data.user) {
    if (error?.status === 429) return { error: TOO_MANY_TRIES, username };
    return { error: LOGIN_MISMATCH, username };
  }

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    // A sign-up that didn't finish setting up. Nothing to show, so don't keep the session.
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This account wasn't set up fully. Create a new one, or try again later.", username };
  }
  redirect(profile.onboarded_at ? next : "/start?step=2");
}

export async function logOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/");
}

/* ------------------------------------------------------------------------ */
/* Reset a forgotten password with a recovery code                           */
/* ------------------------------------------------------------------------ */

export type RecoverState = {
  error?: string;
  field?: "username" | "code" | "password";
  username?: string;
  done?: { codesLeft: number };
};

export async function recoverWithCode(_prev: RecoverState, form: FormData): Promise<RecoverState> {
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const code = String(form.get("code") ?? "");
  const password = String(form.get("password") ?? "");
  if (!isSupabaseConfigured()) return { error: NOT_CONNECTED, username };
  if (!username) return { error: "Type your username.", field: "username", username };
  if (!isRecoveryCode(code)) {
    return { error: "Recovery codes look like K7QM-3XRP: 8 letters and numbers.", field: "code", username };
  }
  const pw = validatePassword(password, username);
  if (!pw.ok) return { error: pw.error, field: "password", username };
  if (!validateUsername(username).ok) return { error: RECOVERY_MISMATCH, username };

  const [userOk, netOk] = await Promise.all([
    takeRateLimit("recover", username),
    networkLabel().then((n) => takeRateLimit("recoverNetwork", n)),
  ]);
  if (!userOk || !netOk) return { error: "Too many tries. Wait an hour, then try again.", username };

  const admin = createServiceSupabase();
  const { data: profile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle<{ id: string }>();
  if (!profile) return { error: RECOVERY_MISMATCH, username };

  const { data: codes } = await admin
    .from("recovery_codes")
    .select("id, code_hash")
    .eq("user_id", profile.id)
    .is("used_at", null);
  let matchId: number | null = null;
  for (const c of (codes ?? []) as { id: number; code_hash: string }[]) {
    if (await verifyRecoveryCode(code, c.code_hash)) {
      matchId = c.id;
      break;
    }
  }
  if (matchId === null) return { error: RECOVERY_MISMATCH, username };

  // Use the code up first ("used_at is null" makes this safe if two resets race).
  const { data: used } = await admin
    .from("recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchId)
    .is("used_at", null)
    .select("id");
  if (!used?.length) return { error: RECOVERY_MISMATCH, username };

  const { error: pwError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (pwError) {
    await admin.from("recovery_codes").update({ used_at: null }).eq("id", matchId);
    console.error("[recover] password update failed:", pwError.message);
    return { error: SOMETHING_WRONG, username };
  }

  // Sign in here, and sign out every other device (someone else may have the old password).
  const supabase = await createServerSupabase();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: internalEmail(username), password });
  if (!signInError) await supabase.auth.signOut({ scope: "others" });

  return { done: { codesLeft: (codes?.length ?? 1) - 1 }, username };
}

/* ------------------------------------------------------------------------ */
/* Signed-in account changes (Settings)                                      */
/* ------------------------------------------------------------------------ */

async function signedInUser(): Promise<{ id: string; username: string } | null> {
  const id = await currentUserId();
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle<{ username: string }>();
  return data ? { id, username: data.username } : null;
}

export async function changeUsername(raw: string): Promise<ActionResult<{ username: string }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const me = await signedInUser();
  if (!me) return fail(NOT_SIGNED_IN);
  const check = validateUsername(String(raw ?? ""));
  if (!check.ok) return fail(check.error);
  if (check.value === me.username) return fail("That's already your username.");
  if (!(await takeRateLimit("rename", me.id))) return fail(TOO_MANY_TRIES);

  // Username and sign-in identity change together; if the second step fails, the first is undone.
  const admin = createServiceSupabase();
  const { error } = await admin.from("profiles").update({ username: check.value }).eq("id", me.id);
  if (error) return fail(isUniqueViolation(error.code) ? "That one's taken." : SOMETHING_WRONG);
  const { error: authError } = await admin.auth.admin.updateUserById(me.id, {
    email: internalEmail(check.value),
    email_confirm: true,
  });
  if (authError) {
    await admin.from("profiles").update({ username: me.username }).eq("id", me.id);
    console.error("[changeUsername] identity update failed:", authError.message);
    return fail(SOMETHING_WRONG);
  }
  return { ok: true, username: check.value };
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const me = await signedInUser();
  if (!me) return fail(NOT_SIGNED_IN);
  if (typeof current !== "string" || !current) return fail("Type your current password.");
  const check = validatePassword(String(next ?? ""), me.username);
  if (!check.ok) return fail(check.error ?? "Pick a different password.");
  if (next === current) return fail("Pick a password you haven't used here.");
  if (!(await takeRateLimit("password", me.id))) return fail(TOO_MANY_TRIES);

  // Check the current password with a separate, throwaway session, so this
  // browser's own session cookies aren't touched.
  const { url, anonKey } = requireSupabaseConfig();
  const probe = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: internalEmail(me.username), password: current });
  if (wrong) return fail("Your current password isn't right.");
  await probe.auth.signOut({ scope: "local" });

  const { error } = await createServiceSupabase().auth.admin.updateUserById(me.id, { password: next });
  if (error) return fail(error.code === "weak_password" ? "Pick a longer or less common password." : SOMETHING_WRONG);

  // Stay signed in here; other devices need the new password.
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

export async function saveRecoveryCodes(codes: string[]): Promise<ActionResult<{ codesLeft: number }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const id = await currentUserId();
  if (!id) return fail(NOT_SIGNED_IN);
  if (!isValidCodeSet(codes)) return fail("Those codes don't look right. Reload the page to get new ones.");
  if (!(await takeRateLimit("recoveryCodes", id))) return fail(TOO_MANY_TRIES);

  // One at a time: each hash uses about 16 MB of memory on purpose.
  const rows: { user_id: string; code_hash: string }[] = [];
  for (const c of codes) rows.push({ user_id: id, code_hash: await hashRecoveryCode(c) });

  // New codes replace old ones and a recovery email (one method at a time).
  const admin = createServiceSupabase();
  const { error: delError } = await admin.from("recovery_codes").delete().eq("user_id", id);
  if (delError) return fail(SOMETHING_WRONG);
  const { error } = await admin.from("recovery_codes").insert(rows);
  if (error) return fail(SOMETHING_WRONG);
  await admin.from("recovery_emails").delete().eq("user_id", id);
  return { ok: true, codesLeft: rows.length };
}

export async function deleteAccount(typedUsername: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const me = await signedInUser();
  if (!me) return fail(NOT_SIGNED_IN);
  if (!canConfirmDelete(String(typedUsername ?? ""), me.username)) return fail(`Type ${me.username} to confirm.`);

  // Deleting the sign-in user removes every row that points to it (ON DELETE CASCADE).
  const { error } = await createServiceSupabase().auth.admin.deleteUser(me.id);
  if (error) {
    console.error("[deleteAccount] failed:", error.message);
    return fail(SOMETHING_WRONG);
  }
  // The session no longer exists on the server; this clears the cookies here.
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
