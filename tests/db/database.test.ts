/**
 * Runs the real migrations and seed in PGlite (Postgres in WebAssembly) and
 * checks the schema rules and row-level security as each API role would see them.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_RESOURCES } from "@/lib/catalog/resources";
import { SKILLS } from "@/lib/catalog/skills";
import { buildSeedSql } from "@/lib/db/seedSql";
import { dedupeKey, normalizePart } from "@/lib/listings/dedupe";
import { listingFromRow, type ListingRow } from "@/lib/listings/listing";
import { manilaDate } from "@/lib/tracker/log";
import { SAMPLE_LISTINGS } from "@/lib/sample/listings";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(path.join(root, ...p), "utf8");

let db: PGlite;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
}
async function asAnon() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role anon");
}
async function asService() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role service_role");
}
async function asAdmin() {
  await db.exec("reset role");
}
const rows = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

/** What the sign-up server action does: a profile with consent and age confirmation, plus settings. */
async function signUp(id: string, username: string) {
  await db.query("insert into public.profiles (id, username, consented_at, age_confirmed_at) values ($1, $2, now(), now())", [id, username]);
  await db.query("insert into public.user_settings (user_id) values ($1)", [id]);
}
async function wipeProfiles() {
  await asAdmin();
  await db.exec("delete from public.profiles");
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("tests", "db", "supabase-shim.sql"));
  const migrations = readdirSync(path.join(root, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migrations) await db.exec(read("supabase", "migrations", m));
  await db.exec(read("supabase", "seed.sql"));
  await db.query("insert into auth.users (id, email) values ($1, 'a@x.invalid'), ($2, 'b@x.invalid')", [A, B]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(asAdmin);

describe("migrations and seed", () => {
  it("seed.sql is up to date with the TypeScript catalogs (run `npm run db:seed` if this fails)", () => {
    expect(read("supabase", "seed.sql")).toBe(buildSeedSql());
  });

  it("loads the reference data and sample listings", async () => {
    const [counts] = await rows<{ fields: number; skills: number; listings: number; closed: number }>(
      `select (select count(*)::int from public.fields) as fields,
              (select count(*)::int from public.skills) as skills,
              (select count(*)::int from public.internships) as listings,
              (select count(*)::int from public.internships where not is_active) as closed`,
    );
    expect(counts).toEqual({ fields: 10, skills: SKILLS.length, listings: SAMPLE_LISTINGS.length, closed: 1 });
  });

  it("can be run twice (seed is idempotent)", async () => {
    await db.exec(read("supabase", "seed.sql"));
    const [c] = await rows<{ n: number }>("select count(*)::int as n from public.internships");
    expect(c.n).toBe(SAMPLE_LISTINGS.length);
  });
});

describe("visitors (anon)", () => {
  beforeEach(wipeProfiles);

  it("can read listings, skills, and schools", async () => {
    await asAnon();
    expect((await rows("select id from public.internships")).length).toBe(SAMPLE_LISTINGS.length);
    expect((await rows("select id from public.skills")).length).toBe(SKILLS.length);
    expect((await rows("select id from public.schools")).length).toBeGreaterThan(0);
  });

  it("can't write listings", async () => {
    await asAnon();
    await expect(db.query("update public.internships set title = 'Hacked' where id = 'ulap-python'")).rejects.toThrow(/permission denied/);
  });

  it("see no profiles or settings and can't create a profile", async () => {
    await signUp(A, "mika.codes");
    await asAnon();
    expect(await rows("select * from public.profiles")).toEqual([]);
    await expect(db.query("select * from public.user_settings")).resolves.toMatchObject({ rows: [] });
    await expect(
      db.query("insert into public.profiles (id, username, consented_at, age_confirmed_at) values ($1, 'someone', now(), now())", [B]),
    ).rejects.toThrow(/permission denied/);
  });

  it("can't test usernames straight through the API (only the rate-limited server can)", async () => {
    await signUp(A, "mika.codes");
    for (const as of [asAnon, () => asUser(B)]) {
      await as();
      await expect(db.query("select public.username_available('mika.codes')")).rejects.toThrow(/permission denied/);
    }
    await asService();
    const [taken] = await rows<{ ok: boolean }>("select public.username_available('Mika.Codes ') as ok");
    const [free] = await rows<{ ok: boolean }>("select public.username_available('ana.reyes') as ok");
    expect(taken.ok).toBe(false);
    expect(free.ok).toBe(true);
  });
});

describe("profiles (signed-in users)", () => {
  beforeEach(wipeProfiles);

  it("are created only by the server, never through the API", async () => {
    await asUser(A);
    await expect(
      db.query("insert into public.profiles (id, username, consented_at, age_confirmed_at) values ($1, 'mika.codes', now(), now())", [A]),
    ).rejects.toThrow(/permission denied/);
  });

  it("require consent and the age confirmation", async () => {
    await expect(db.query("insert into public.profiles (id, username, consented_at) values ($1, 'mika.codes', now())", [A])).rejects.toThrow(
      /age_confirmed_at/,
    );
    await expect(db.query("insert into public.profiles (id, username, age_confirmed_at) values ($1, 'mika.codes', now())", [A])).rejects.toThrow(
      /consented_at/,
    );
  });

  it("can read and update only their own profile", async () => {
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
    await asUser(A);
    expect(await rows("select username from public.profiles")).toEqual([{ username: "mika.codes" }]);
    const mine = await db.query("update public.profiles set city_name = 'Pasig', work_type = 'remote' where id = $1", [A]);
    expect(mine.affectedRows).toBe(1);
    const theirs = await db.query("update public.profiles set city_name = 'Pasig' where id = $1", [B]);
    expect(theirs.affectedRows).toBe(0);
  });

  it("can't change their username, consent, or age confirmation through the API", async () => {
    await signUp(A, "mika.codes");
    await asUser(A);
    for (const sql of [
      "update public.profiles set username = 'admin.ph' where id = $1",
      "update public.profiles set consented_at = null where id = $1",
      "update public.profiles set age_confirmed_at = now() where id = $1",
    ]) {
      await expect(db.query(sql, [A]), sql).rejects.toThrow(/permission denied/);
    }
  });

  it("enforces the username rules the form uses", async () => {
    for (const bad of ["Mika", "ab", "1mika", "mika.", "mi..ka", "admin", "a".repeat(21)]) {
      await expect(
        db.query("insert into public.profiles (id, username, consented_at, age_confirmed_at) values ($1, $2, now(), now())", [A, bad]),
        bad,
      ).rejects.toThrow(/check constraint|violates/);
    }
  });

  it("keeps usernames unique", async () => {
    await signUp(A, "mika.codes");
    await expect(signUp(B, "mika.codes")).rejects.toThrow(/duplicate key/);
  });

  it("stores only a rounded city location, both coordinates or none", async () => {
    await signUp(A, "mika.codes");
    await asUser(A);
    await db.query("update public.profiles set lat = 14.676041, lng = 121.043700, city_name = 'Quezon City' where id = $1", [A]);
    const [p] = await rows<{ lat: string; lng: string }>("select lat::text, lng::text from public.profiles where id = $1", [A]);
    expect(p).toEqual({ lat: "14.68", lng: "121.04" });
    await expect(db.query("update public.profiles set lat = null where id = $1", [A])).rejects.toThrow(/city_has_both_coordinates/);
  });

  it("updates updated_at on change", async () => {
    await signUp(A, "mika.codes");
    await db.exec("update public.profiles set updated_at = now() - interval '1 day'");
    await asUser(A);
    await db.query("update public.profiles set work_type = 'hybrid' where id = $1", [A]);
    const [p] = await rows<{ fresh: boolean }>("select updated_at > now() - interval '1 minute' as fresh from public.profiles");
    expect(p.fresh).toBe(true);
  });

  it("can mark onboarding as finished", async () => {
    await signUp(A, "mika.codes");
    await asUser(A);
    await db.query("update public.profiles set onboarded_at = now() where id = $1 and onboarded_at is null", [A]);
    const [p] = await rows<{ done: boolean }>("select onboarded_at is not null as done from public.profiles");
    expect(p.done).toBe(true);
  });
});

describe("settings", () => {
  beforeEach(async () => {
    await wipeProfiles();
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
  });

  it("start with the defaults (Full Quest, sound off)", async () => {
    const [s] = await rows<{ mode: string; sound: boolean; show_on_leaderboard: boolean }>(
      "select mode, sound, show_on_leaderboard from public.user_settings where user_id = $1",
      [A],
    );
    expect(s).toEqual({ mode: "full", sound: false, show_on_leaderboard: true });
  });

  it("can be read and changed only by their owner", async () => {
    await asUser(A);
    expect((await rows("select user_id from public.user_settings")).length).toBe(1);
    expect((await db.query("update public.user_settings set mode = 'plain' where user_id = $1", [A])).affectedRows).toBe(1);
    expect((await db.query("update public.user_settings set mode = 'plain' where user_id = $1", [B])).affectedRows).toBe(0);
    await expect(db.query("update public.user_settings set user_id = $1 where user_id = $1", [A])).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.user_settings where user_id = $1", [A])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.user_settings set mode = 'turbo' where user_id = $1", [A])).rejects.toThrow(/check constraint/);
  });
});

describe("user skills", () => {
  beforeEach(async () => {
    await wipeProfiles();
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
  });

  it("lets users manage only their own skills", async () => {
    await asUser(A);
    await db.query("insert into public.user_skills (user_id, skill_id) values ($1, 'c')", [A]);
    await expect(db.query("insert into public.user_skills (user_id, skill_id) values ($1, 'c')", [B])).rejects.toThrow(/row-level security/);
    expect(await rows("select skill_id from public.user_skills")).toEqual([{ skill_id: "c" }]);
  });

  it("allows at most 10", async () => {
    await asUser(A);
    const ids = SKILLS.slice(0, 11).map((s) => s.id);
    for (const id of ids.slice(0, 10)) await db.query("insert into public.user_skills (user_id, skill_id) values ($1, $2)", [A, id]);
    await expect(db.query("insert into public.user_skills (user_id, skill_id) values ($1, $2)", [A, ids[10]])).rejects.toThrow(/at most 10/);
  });

  it("set_my_skills replaces the whole list for the caller only", async () => {
    await db.query("insert into public.user_skills (user_id, skill_id) values ($1, 'python')", [B]);
    await asUser(A);
    await db.query("select public.set_my_skills($1)", [["c", "arduino"]]);
    await db.query("select public.set_my_skills($1)", [["arduino", "sensors", "sensors"]]);
    expect((await rows<{ skill_id: string }>("select skill_id from public.user_skills order by skill_id")).map((r) => r.skill_id)).toEqual([
      "arduino",
      "sensors",
    ]);
    await asAdmin();
    expect(await rows("select skill_id from public.user_skills where user_id = $1", [B])).toEqual([{ skill_id: "python" }]);
  });

  it("set_my_skills refuses more than 10, unknown skills, and signed-out callers", async () => {
    await asUser(A);
    await expect(db.query("select public.set_my_skills($1)", [SKILLS.slice(0, 11).map((s) => s.id)])).rejects.toThrow(/at most 10/);
    await expect(db.query("select public.set_my_skills($1)", [["not-a-skill"]])).rejects.toThrow(/foreign key/);
    await asAnon();
    await expect(db.query("select public.set_my_skills($1)", [["c"]])).rejects.toThrow(/permission denied/);
  });
});

describe("recovery data and account deletion", () => {
  beforeEach(wipeProfiles);

  it("keeps recovery codes and emails away from every API role", async () => {
    await db.query("insert into public.recovery_codes (user_id, code_hash) values ($1, 'hash')", [A]);
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.recovery_codes")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.recovery_emails")).rejects.toThrow(/permission denied/);
    }
    await asAdmin();
    await db.exec("delete from public.recovery_codes");
  });

  it("my_recovery tells users only their own status, never the hashes", async () => {
    await db.query("insert into public.recovery_codes (user_id, code_hash, used_at) values ($1, 'h1', null), ($1, 'h2', null), ($1, 'h3', now()), ($2, 'h4', null)", [
      A,
      B,
    ]);
    await asUser(A);
    expect(await rows("select * from public.my_recovery()")).toEqual([{ codes_left: 2, email: null }]);
    await asAnon();
    await expect(db.query("select * from public.my_recovery()")).rejects.toThrow(/permission denied/);
    await asAdmin();
    await db.exec("delete from public.recovery_codes");
  });

  it("deletes everything a user owns when the account is deleted", async () => {
    await signUp(A, "mika.codes");
    await db.query("insert into public.user_skills (user_id, skill_id) values ($1, 'c')", [A]);
    await db.query("insert into public.recovery_codes (user_id, code_hash) values ($1, 'hash')", [A]);
    await db.query("insert into public.recovery_emails (user_id, email) values ($1, 'mika@example.com')", [A]);
    await db.query("delete from auth.users where id = $1", [A]);
    const [left] = await rows<{ n: number }>(
      `select (select count(*) from public.profiles where id = $1)
            + (select count(*) from public.user_settings where user_id = $1)
            + (select count(*) from public.user_skills where user_id = $1)
            + (select count(*) from public.recovery_codes where user_id = $1)
            + (select count(*) from public.recovery_emails where user_id = $1) as n`,
      [A],
    );
    expect(Number(left.n)).toBe(0);
    await db.query("insert into auth.users (id, email) values ($1, 'a@x.invalid')", [A]);
  });
});

describe("rate limits", () => {
  beforeEach(async () => {
    await asAdmin();
    await db.exec("delete from public.rate_limits");
  });

  const take = async (bucket: string, max: number, windowSeconds: number) => {
    const [r] = await rows<{ ok: boolean }>("select public.take_rate_limit($1, $2, $3) as ok", [bucket, max, windowSeconds]);
    return r.ok;
  };

  it("lets tries through up to the limit, then blocks", async () => {
    await asService();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await take("login:mika.codes", 3, 900));
    expect(results).toEqual([true, true, true, false]);
    expect(await take("login:ana.reyes", 3, 900)).toBe(true); // other buckets are separate
  });

  it("starts a fresh window once the old one is over", async () => {
    await asService();
    for (let i = 0; i < 3; i++) await take("login:mika.codes", 3, 900);
    await asAdmin();
    await db.exec("update public.rate_limits set window_start = now() - interval '16 minutes'");
    await asService();
    expect(await take("login:mika.codes", 3, 900)).toBe(true);
    await asAdmin();
    expect(await rows("select hits from public.rate_limits")).toEqual([{ hits: 1 }]);
  });

  it("refuses silly settings", async () => {
    await asService();
    await expect(take("x", 0, 900)).rejects.toThrow(/Bad rate limit/);
    await expect(take("x", 5, 100_000)).rejects.toThrow(/Bad rate limit/);
  });

  it("can't be called or read through the public API", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(take("login:mika.codes", 3, 900)).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.rate_limits")).rejects.toThrow(/permission denied/);
    }
  });
});

describe("place lookups cache", () => {
  it("is for server code only", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.geocode_cache")).rejects.toThrow(/permission denied/);
    }
  });

  it("stores a found place with its location, or a miss with nothing", async () => {
    await asService();
    await db.query("insert into public.geocode_cache (query, found, name, lat, lng) values ('lipa', true, 'Lipa, Batangas', 13.9411, 121.1631)");
    await db.query("insert into public.geocode_cache (query, found) values ('asdfgh', false)");
    await expect(db.query("insert into public.geocode_cache (query, found, name) values ('x1', true, 'X')")).rejects.toThrow(/found_has_place/);
    await expect(db.query("insert into public.geocode_cache (query, found, name, lat, lng) values ('x2', false, 'X', 1, 1)")).rejects.toThrow(
      /found_has_place/,
    );
    await asAdmin();
    expect(await rows("select lat::text, lng::text from public.geocode_cache where query = 'lipa'")).toEqual([{ lat: "13.94", lng: "121.16" }]);
    await db.exec("delete from public.geocode_cache");
  });
});

describe("listings read back from the database", () => {
  it("map to the same listings the app shows", async () => {
    await asAnon();
    const data = await rows<ListingRow>(
      `select i.*, i.deadline::text as deadline, coalesce((select json_agg(json_build_object('skill_id', s.skill_id, 'required', s.required))
                              from public.internship_skills s where s.internship_id = i.id), '[]') as internship_skills
         from public.internships i`,
    );
    const now = new Date();
    const mapped = new Map(data.map((r) => [r.id, listingFromRow(r, manilaDate(now), now)]));
    expect(mapped.size).toBe(SAMPLE_LISTINGS.length);
    for (const sample of SAMPLE_LISTINGS) {
      const l = mapped.get(sample.id);
      expect(l, sample.id).not.toBeNull();
      expect(l).toMatchObject({
        title: sample.title,
        company: sample.company,
        field: sample.field,
        workType: sample.workType,
        apply: sample.apply,
        location: sample.location,
      });
      expect(l!.deadlineInDays === null ? null : l!.deadlineInDays < 0, sample.id).toBe(
        sample.deadlineInDays === null ? null : sample.deadlineInDays < 0,
      );
      expect(new Set(l!.skills.map((x) => `${x.id}:${x.required}`))).toEqual(new Set(sample.skills.map((x) => `${x.id}:${x.required}`)));
    }
  });
});

describe("quest log (applications)", () => {
  const add = (listing: string | null, extra = "") =>
    db.query(
      `insert into public.applications (internship_id, title, company${extra ? ", " + extra.split("=")[0] : ""}) values ($1, 'T', 'C'${extra ? ", " + extra.split("=")[1] : ""}) returning id`,
      [listing],
    );

  beforeEach(async () => {
    await wipeProfiles();
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
  });

  it("is private: users see and change only their own entries", async () => {
    await asUser(A);
    const { rows: mine } = await add("kalye-data-analyst");
    await asUser(B);
    expect(await rows("select id from public.applications")).toEqual([]);
    expect((await db.query("update public.applications set note = 'x' where id = $1", [(mine[0] as { id: string }).id])).affectedRows).toBe(0);
    expect((await db.query("delete from public.applications where id = $1", [(mine[0] as { id: string }).id])).affectedRows).toBe(0);
    await expect(
      db.query("insert into public.applications (user_id, title, company) values ($1, 'T', 'C')", [A]),
    ).rejects.toThrow(/permission denied|row-level security/);
    await asAnon();
    await expect(db.query("select * from public.applications")).rejects.toThrow(/permission denied/);
  });

  it("only the server can mark an application confirmed or record a click", async () => {
    await asUser(A);
    await expect(add("kalye-data-analyst", "confirmed_at=now()")).rejects.toThrow(/permission denied/);
    const { rows: r } = await add("kalye-data-analyst");
    const id = (r[0] as { id: string }).id;
    await expect(db.query("update public.applications set confirmed_at = now() where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.applications set last_clicked_at = now() where id = $1", [id])).rejects.toThrow(/permission denied/);
    expect((await db.query("update public.applications set status = 'applied', applied_on = current_date, note = 'sent CV' where id = $1", [id])).affectedRows).toBe(1);
    await asService();
    expect((await db.query("update public.applications set confirmed_at = now() where id = $1", [id])).affectedRows).toBe(1);
  });

  it("keeps one entry per listing, and outcomes only in Result", async () => {
    await asUser(A);
    await add("kalye-data-analyst");
    await expect(add("kalye-data-analyst")).rejects.toThrow(/duplicate key/);
    await add(null);
    await add(null); // hand-added entries can repeat
    await expect(add("ulap-python", "outcome='offer'")).rejects.toThrow(/outcome_only_for_result/);
    await expect(add(null, "url='javascript:alert(1)'")).rejects.toThrow(/url_check/);
  });

  it("deleting an account removes the log and unlinks Apply clicks (listing totals stay)", async () => {
    await asService();
    await db.query("insert into public.click_logs (internship_id, user_id, kind) values ('kalye-data-analyst', $1, 'link'), ('kalye-data-analyst', null, 'link')", [A]);
    await asUser(A);
    await add("kalye-data-analyst");
    await asAdmin();
    await db.query("delete from auth.users where id = $1", [A]);
    expect(await rows("select count(*)::int as n from public.applications where user_id = $1", [A])).toEqual([{ n: 0 }]);
    expect(await rows("select count(*)::int as n, count(user_id)::int as linked from public.click_logs")).toEqual([{ n: 2, linked: 0 }]);
    await db.exec("delete from public.click_logs");
    await db.query("insert into auth.users (id, email) values ($1, 'a@x.invalid')", [A]);
  });

  it("keeps Apply clicks away from the public API", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.click_logs")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into public.click_logs (internship_id, kind) values ('ulap-python', 'link')")).rejects.toThrow(/permission denied/);
    }
  });
});

describe("EXP, badges, and the leaderboard", () => {
  const C = "33333333-3333-4333-8333-333333333333";
  const WEEK = "2026-11-08T16:00:00.000Z"; // Monday Nov 9, 00:00 Manila

  beforeEach(async () => {
    await wipeProfiles();
    await db.query("insert into auth.users (id, email) values ($1, 'c@x.invalid') on conflict do nothing", [C]);
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
    await signUp(C, "plain.jun");
    await db.exec("update public.profiles set onboarded_at = now()");
    await db.query("update public.user_settings set mode = 'plain' where user_id = $1", [C]);
  });

  it("only the server writes EXP and badges; users read their own", async () => {
    await asService();
    await db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'profile', 'once', 50)", [A]);
    await db.query("insert into public.user_badges (user_id, badge_id) values ($1, 'first-quest')", [A]);
    await asUser(A);
    expect(await rows("select kind, amount from public.exp_events")).toEqual([{ kind: "profile", amount: 50 }]);
    expect(await rows("select badge_id from public.user_badges")).toEqual([{ badge_id: "first-quest" }]);
    await expect(db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'confirm', 'x', 20)", [A])).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("update public.exp_events set amount = 100")).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.user_badges (user_id, badge_id) values ($1, 'scout')", [A])).rejects.toThrow(/permission denied/);
    await asUser(B);
    expect(await rows("select * from public.exp_events")).toEqual([]);
  });

  it("pays each action once (unique kind and ref) and refuses silly amounts", async () => {
    await asService();
    await db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'confirm', 'ulap-python', 20)", [A]);
    await expect(db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'confirm', 'ulap-python', 20)", [A])).rejects.toThrow(
      /exp_once/,
    );
    const again = await db.query(
      "insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'confirm', 'ulap-python', 20) on conflict (user_id, kind, ref) do nothing",
      [A],
    );
    expect(again.affectedRows).toBe(0);
    await expect(db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'confirm', 'big', 500)", [A])).rejects.toThrow(
      /amount_check/,
    );
  });

  it("ranks Full Quest players who aren't hidden, plus you, with weekly and total EXP", async () => {
    await asService();
    await db.query(
      `insert into public.exp_events (user_id, kind, ref, amount, created_at) values
         ($1, 'profile', 'once', 50, '2026-11-02T00:00:00Z'), ($1, 'confirm', 'a', 20, '2026-11-10T00:00:00Z'),
         ($2, 'profile', 'once', 50, '2026-11-10T00:00:00Z'),
         ($3, 'profile', 'once', 50, '2026-11-10T00:00:00Z')`,
      [A, B, C],
    );
    await db.query("insert into public.applications (user_id, title, company, status, confirmed_at) values ($1, 'T', 'C', 'applied', '2026-11-10T00:00:00Z')", [A]);
    await db.query("update public.user_settings set show_on_leaderboard = false where user_id = $1", [B]);

    const board = async (me: string) =>
      rows<{ username: string; week_exp: number; total_exp: number; week_apps: number; hidden: boolean; is_me: boolean }>(
        "select username, week_exp, total_exp, week_apps, hidden, is_me from public.leaderboard_entries($1, $2) order by username",
        [me, WEEK],
      );
    // Mika sees herself; Ana is hidden; Jun plays Plain, so he's never listed.
    expect(await board(A)).toEqual([{ username: "mika.codes", week_exp: 20, total_exp: 70, week_apps: 1, hidden: false, is_me: true }]);
    // Ana still sees her own row (marked hidden), plus Mika.
    expect((await board(B)).map((r) => [r.username, r.hidden, r.is_me])).toEqual([
      ["ana.reyes", true, true],
      ["mika.codes", false, false],
    ]);
  });

  it("the leaderboard query and activity flags are server only", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.leaderboard_entries($1, now())", [A])).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.activity_flags")).rejects.toThrow(/permission denied/);
    }
  });

  it("deleting an account deletes its EXP, badges, and flags", async () => {
    await asService();
    await db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'profile', 'once', 50)", [A]);
    await db.query("insert into public.user_badges (user_id, badge_id) values ($1, 'scout')", [A]);
    await db.query("insert into public.activity_flags (user_id, reason) values ($1, 'test')", [A]);
    await asAdmin();
    await db.query("delete from auth.users where id = $1", [A]);
    const [left] = await rows<{ n: number }>(
      `select (select count(*) from public.exp_events where user_id = $1) + (select count(*) from public.user_badges where user_id = $1)
            + (select count(*) from public.activity_flags where user_id = $1) as n`,
      [A],
    );
    expect(Number(left.n)).toBe(0);
    await db.query("insert into auth.users (id, email) values ($1, 'a@x.invalid')", [A]);
  });
});

describe("learning, tips progress, and AI usage", () => {
  beforeEach(async () => {
    await wipeProfiles();
    await signUp(A, "mika.codes");
    await signUp(B, "ana.reyes");
  });

  it("anyone can read learning resources; nobody can change them through the API", async () => {
    await asAnon();
    const [r] = await rows<{ n: number }>("select count(*)::int as n from public.skill_resources");
    expect(r.n).toBe(ALL_RESOURCES.length);
    await expect(db.query("update public.skill_resources set url = 'https://evil.example'")).rejects.toThrow(/permission denied/);
  });

  it("users read only their own checklist progress, and can't write it directly", async () => {
    await asService();
    await db.query("insert into public.tips_progress (user_id, slug, done) values ($1, 'resume', '{a,b}'), ($2, 'resume', '{c}')", [A, B]);
    await asUser(A);
    expect(await rows("select slug, done from public.tips_progress")).toEqual([{ slug: "resume", done: ["a", "b"] }]);
    await expect(db.query("update public.tips_progress set done = '{x}'")).rejects.toThrow(/permission denied/);
  });

  it("resource opens and AI usage are server only", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.resource_opens")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.ai_usage")).rejects.toThrow(/permission denied/);
    }
  });

  it("accepts the new EXP kinds for resources and cover letters", async () => {
    await asService();
    await db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'resource', 'python', 15), ($1, 'cover_letter', 'ulap-python', 10)", [A]);
    await expect(db.query("insert into public.exp_events (user_id, kind, ref, amount) values ($1, 'made_up', 'x', 10)", [A])).rejects.toThrow(
      /exp_events_kind_check/,
    );
  });
});

describe("daily refresh: expiry, one row per posting, import log", () => {
  const add = (id: string, source: string, deadline: string | null, lastChecked: string, ref: string | null = null) =>
    db.query(
      `insert into public.internships (id, title, company_name, source, source_ref, field_id, area, work_type, snippet, apply_kind, apply_url, dedupe_key, deadline, last_checked)
       values ($1, 'Test Intern', 'Test Co', $2, $5, 'web', 'Pasig', 'onsite', 'A test.', 'link', 'https://x.ph', $1, $3, $4)`,
      [id, source, deadline, lastChecked, ref],
    );

  beforeEach(async () => {
    await asAdmin();
    await db.exec("delete from public.internships where id like 't5-%'");
  });

  it("hides listings past their deadline, and aggregator listings not seen for 14 days", async () => {
    await add("t5-past", "direct", "2020-01-01", "now()");
    await add("t5-open", "direct", "2099-01-01", "now()");
    await add("t5-stale", "jsearch", null, new Date(Date.now() - 20 * 86_400_000).toISOString(), "r1");
    await add("t5-fresh", "jsearch", null, new Date().toISOString(), "r2");
    await add("t5-old-direct", "direct", null, new Date(Date.now() - 90 * 86_400_000).toISOString());
    await asService();
    const [r] = await rows<{ expired: number; stale: number }>("select * from public.expire_listings(14)");
    expect(r).toEqual({ expired: 1, stale: 1 });
    await asAdmin();
    const active = await rows<{ id: string }>("select id from public.internships where id like 't5-%' and is_active order by id");
    // A direct post isn't hidden for age; it has no "last seen" in a source.
    expect(active.map((a) => a.id)).toEqual(["t5-fresh", "t5-old-direct", "t5-open"]);
  });

  it("stores each source posting once", async () => {
    await add("t5-a", "jsearch", null, new Date().toISOString(), "same-ref");
    await expect(add("t5-b", "jsearch", null, new Date().toISOString(), "same-ref")).rejects.toThrow(/internships_source_ref/);
  });

  it("the import log and the expiry job are server only", async () => {
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select * from public.import_runs")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.expire_listings(14)")).rejects.toThrow(/permission denied/);
    }
  });
});

describe("companies, drafts, admins, and reports (Phase 6)", () => {
  const C = "44444444-4444-4444-8444-444444444444";

  beforeEach(async () => {
    await wipeProfiles();
    await db.query("insert into auth.users (id, email) values ($1, 'hr@tanglaw.example.com') on conflict do nothing", [C]);
    await asService();
    await db.exec("delete from public.companies");
    await db.exec("delete from public.admins");
    await db.exec("delete from public.admin_audit");
    await db.exec("delete from public.reports");
    await db.exec("delete from public.internships where id like 't6-%'");
    await db.query(
      "insert into public.companies (id, name, website, work_email, role) values ($1, 'Tanglaw Solar', 'https://tanglaw.example.com', 'hr@tanglaw.example.com', 'HR Officer')",
      [C],
    );
  });

  it("a company reads only its own row, and can't write it directly (name, status, anything)", async () => {
    await asUser(C);
    expect(await rows("select name from public.companies")).toEqual([{ name: "Tanglaw Solar" }]);
    await expect(db.query("update public.companies set name = 'Someone Else Inc' where id = $1", [C])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.companies set status = 'approved' where id = $1", [C])).rejects.toThrow(/permission denied/);
    await asAnon();
    await expect(db.query("select * from public.companies")).resolves.toMatchObject({ rows: [] });
  });

  it("tracks when a listing was last edited (the company dashboard orders by it)", async () => {
    await asService();
    await db.query("insert into public.internships (id, company_id, company_name, source, status, title, dedupe_key) values ('t6-edit', $1, 'Tanglaw Solar', 'direct', 'draft', 'Firmware Intern', 't6-edit')", [C]);
    await db.exec("update public.internships set updated_at = now() - interval '2 days' where id = 't6-edit'");
    await db.exec("update public.internships set title = 'Firmware Intern II' where id = 't6-edit'");
    // The exact columns and ordering src/lib/company/server.ts asks for.
    const list = await rows<{ id: string; fresh: boolean }>(
      "select id, id, title, status, is_active, deadline, updated_at, created_at, updated_at > now() - interval '1 minute' as fresh from public.internships where company_id = $1 order by updated_at desc",
      [C],
    );
    expect(list[0]).toMatchObject({ id: "t6-edit", fresh: true });
    await db.exec("delete from public.internships where id = 't6-edit'");
  });

  it("a draft is never publicly visible, but a published or closed listing is", async () => {
    await asService();
    const base = `insert into public.internships (id, company_id, company_name, source, status, title, dedupe_key) values ($1, $2, 'Tanglaw Solar', 'direct', $3, 'Firmware Intern', $1)`;
    await db.query(base, ["t6-draft", C, "draft"]);
    await db.query(base, ["t6-closed", C, "closed"]);
    await db.query(
      `insert into public.internships (id, company_id, company_name, source, status, title, field_id, area, work_type, snippet, apply_kind, apply_url, dedupe_key)
       values ('t6-live', $1, 'Tanglaw Solar', 'direct', 'published', 'Firmware Intern', 'iot', 'Cubao', 'onsite', 'x', 'link', 'https://tanglaw.example.com/apply', 't6-live')`,
      [C],
    );
    await asAnon();
    const visible = (await rows<{ id: string }>("select id from public.internships where id like 't6-%' order by id")).map((r) => r.id);
    expect(visible).toEqual(["t6-closed", "t6-live"]);
  });

  it("a draft needs only a title; publishing needs the rest (listing_published_complete)", async () => {
    await asService();
    await db.query(
      "insert into public.internships (id, company_id, company_name, source, status, title, dedupe_key) values ('t6-min', $1, 'Tanglaw Solar', 'direct', 'draft', 'Firmware Intern', 't6-min')",
      [C],
    );
    await expect(db.query("update public.internships set status = 'published' where id = 't6-min'")).rejects.toThrow(/listing_published_complete/);
    await db.query(
      `update public.internships set field_id = 'iot', area = 'Cubao', work_type = 'onsite', snippet = 'x', apply_kind = 'link', apply_url = 'https://tanglaw.example.com/apply', verified = true
       where id = 't6-min'`,
    );
    await expect(db.query("update public.internships set status = 'published' where id = 't6-min'")).resolves.toBeDefined();
  });

  it("allows apply_kind to be null (a draft with no apply method yet)", async () => {
    await asService();
    await expect(
      db.query(
        "insert into public.internships (id, company_id, company_name, source, status, title, dedupe_key) values ('t6-noapply', $1, 'Tanglaw Solar', 'direct', 'draft', 'Firmware Intern', 't6-noapply')",
        [C],
      ),
    ).resolves.toBeDefined();
  });

  it("admins, admin_audit, and reports are server only", async () => {
    for (const as of [asAnon, () => asUser(C)]) {
      await as();
      await expect(db.query("select * from public.admins")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.admin_audit")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.reports")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into public.reports (internship_id, reason) values ('x', 'payment')")).rejects.toThrow(/permission denied/);
    }
  });

  it("deleting a company's auth user removes the company row and unlinks (not deletes) its listings", async () => {
    await asService();
    await db.query(
      "insert into public.internships (id, company_id, company_name, source, status, title, dedupe_key) values ('t6-orphan', $1, 'Tanglaw Solar', 'direct', 'draft', 'Firmware Intern', 't6-orphan')",
      [C],
    );
    await asAdmin();
    await db.query("delete from auth.users where id = $1", [C]);
    expect(await rows("select count(*)::int as n from public.companies where id = $1", [C])).toEqual([{ n: 0 }]);
    const [listing] = await rows<{ company_id: string | null; title: string }>("select company_id, title from public.internships where id = 't6-orphan'");
    expect(listing).toEqual({ company_id: null, title: "Firmware Intern" });
    await db.exec("delete from public.internships where id = 't6-orphan'");
    await db.query("insert into auth.users (id, email) values ($1, 'hr@tanglaw.example.com')", [C]);
  });
});

describe("listing rules", () => {
  it("rejects http apply links and a link plus an email at once", async () => {
    const base = `insert into public.internships (id, title, company_name, source, field_id, area, work_type, snippet, apply_kind, apply_url, apply_email, dedupe_key)
                  values ($1, 'Test Intern', 'Test Co', 'admin', 'web', 'Pasig', 'onsite', 'A test.', $2, $3, $4, $1)`;
    await expect(db.query(base, ["t-http", "link", "http://x.ph", null])).rejects.toThrow(/apply_url_check/);
    await expect(db.query(base, ["t-both", "link", "https://x.ph", "hr@x.ph"])).rejects.toThrow(/apply_target/);
  });

  it("caps snippets at 600 characters (outside listings: snippet only)", async () => {
    await expect(
      db.query(
        `insert into public.internships (id, title, company_name, source, field_id, area, work_type, snippet, apply_kind, apply_url, dedupe_key)
         values ('t-long', 'Test Intern', 'Test Co', 'jsearch', 'web', 'Pasig', 'onsite', $1, 'link', 'https://x.ph', 't-long')`,
        ["x".repeat(601)],
      ),
    ).rejects.toThrow(/snippet_check/);
  });

  it("stores the same job from two sources once", async () => {
    expect(dedupeKey("Kalye Logistics Inc.", "Data Analyst OJT", "Ortigas, Pasig")).toBe(dedupeKey("KALYE LOGISTICS", "Data Analyst  OJT", "Pasig"));
    expect(normalizePart("Parañaque & Co.")).toBe("paranaque and co");
    const dup = `insert into public.internships (id, title, company_name, source, field_id, area, work_type, snippet, apply_kind, apply_url, dedupe_key)
                 values ($1, 'Data Analyst OJT', 'Kalye Logistics', 'jsearch', 'data', 'Pasig', 'onsite', 'x', 'link', 'https://x.ph', $2)`;
    await expect(db.query(dup, ["kalye-dup", dedupeKey("Kalye Logistics", "Data Analyst OJT", "Pasig")])).rejects.toThrow(/duplicate key/);
  });
});

describe("retention clean-up (Phase 7)", () => {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  beforeEach(async () => {
    await asAdmin();
    await db.exec("delete from public.click_logs; delete from public.reports; delete from public.admin_audit");
  });

  it("deletes only data past its period, and never an open report", async () => {
    const [{ id: listing }] = await rows<{ id: string }>("select id from public.internships order by id limit 1");
    await db.query("insert into public.click_logs (internship_id, kind, created_at) values ($1, 'link', $2), ($1, 'link', $3)", [listing, ago(400), ago(10)]);
    await db.query(
      `insert into public.reports (internship_id, reason, created_at, resolved_at, resolution) values
         ($1, 'scam', $2, $2, 'Dismissed'),  -- resolved long ago: deleted
         ($1, 'scam', $3, $3, 'Dismissed'),  -- resolved recently: kept
         ($1, 'payment', $2, null, null)     -- open, however old: kept`,
      [listing, ago(400), ago(5)],
    );
    await db.query("insert into public.admin_audit (admin_label, kind, item_id, subject, action, reason, created_at) values ('me', 'report', 'r-x', 'x', 'Hide', 'Scam', $1)", [ago(30)]);

    await asService();
    const [{ purge_old_data: counts }] = await rows<{ purge_old_data: Record<string, number> }>("select public.purge_old_data(365, 180, 180, 730, 90)");
    expect(counts).toMatchObject({ clicks: 1, reports: 1, audit: 0 });

    await asAdmin();
    expect(await rows("select count(*)::int as n from public.click_logs")).toEqual([{ n: 1 }]);
    expect(await rows("select reason, resolved_at is null as open from public.reports order by reason")).toEqual([
      { reason: "payment", open: true },
      { reason: "scam", open: false },
    ]);
    expect(await rows("select count(*)::int as n from public.admin_audit")).toEqual([{ n: 1 }]);
  });

  it("logs an admin CSV import in the audit log, and still refuses unknown kinds", async () => {
    await asService();
    await db.query("insert into public.admin_audit (admin_label, kind, item_id, subject, action, reason) values ('me', 'import', 'csv-1', 'listings.csv (3 listings)', 'Imported listings', '3 new')");
    await expect(
      db.query("insert into public.admin_audit (admin_label, kind, item_id, subject, action, reason) values ('me', 'party', 'x', 'x', 'x', 'x')"),
    ).rejects.toThrow(/admin_audit_kind_check/);
  });

  it("refuses a period under a week, and is server only", async () => {
    await asService();
    await expect(db.query("select public.purge_old_data(1, 180, 180, 730, 90)")).rejects.toThrow(/at least 7 days/);
    for (const as of [asAnon, () => asUser(A)]) {
      await as();
      await expect(db.query("select public.purge_old_data(365, 180, 180, 730, 90)")).rejects.toThrow(/permission denied/);
    }
  });
});
