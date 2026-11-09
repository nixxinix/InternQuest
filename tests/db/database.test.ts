/**
 * Runs the real migrations and seed in PGlite (Postgres in WebAssembly) and
 * checks the schema rules and row-level security as each API role would see them.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
      `select i.*, coalesce((select json_agg(json_build_object('skill_id', s.skill_id, 'required', s.required))
                              from public.internship_skills s where s.internship_id = i.id), '[]') as internship_skills
         from public.internships i`,
    );
    const now = new Date();
    const mapped = new Map(data.map((r) => [r.id, listingFromRow({ ...r, deadline: r.deadline && String(r.deadline).slice(0, 10) }, manilaDate(now), now)]));
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
