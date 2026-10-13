import { createClient } from "@supabase/supabase-js";
import { assertSeedTarget } from "./seed-safety.mjs";
assertSeedTarget(process.env, { allowHostedStaging: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const local = new URL(url).protocol === "http:";
const roles = ["admin", "teacher", "cskh"];
const passwords = roles.map((role) => process.env[`GAMI_STAGING_${role.toUpperCase()}_PASSWORD`] || (local ? process.env.GAMI_SEED_PASSWORD : ""));
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || passwords.some((p) => !p || p.length < 16)) throw new Error("seed_blocked:server_key_and_three_strong_passwords_required");
if (!local && new Set(passwords).size !== 3) throw new Error("seed_blocked:distinct_staging_passwords_required");
if (process.argv.includes("--dry-run")) {
  console.info("Staging seed configuration PASS; planned 3 accounts, 1 class, 15 synthetic students; no remote writes performed.");
  process.exit(0);
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const check = (r) => { if (r.error) throw new Error(`staging_seed_failed:${r.error.code ?? "unknown"}`); return r.data; };
const users = [];
for (let page = 1; ; page++) {
  const data = check(await db.auth.admin.listUsers({ page, perPage: 1000 }));
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const ids = [];
for (let i = 0; i < roles.length; i++) {
  const role = roles[i], email = `staging.${role}@gami.example`;
  const user = users.find((u) => u.email === email) ?? check(await db.auth.admin.createUser({ email, password: passwords[i], email_confirm: true })).user;
  if (!user) throw new Error("staging_seed_failed:missing_auth_user");
  const profile = check(await db.from("profiles").select("id,role,active").eq("id", user.id).maybeSingle());
  if (profile && (profile.role !== role || !profile.active)) throw new Error("staging_seed_blocked:existing_profile_requires_operator_review");
  if (!profile) check(await db.from("profiles").insert({ id: user.id, role, full_name: `STAGING ${role}`, active: true }));
  ids.push(user.id);
}
const classId = "22000000-0000-0000-0000-000000000001";
const existing = check(await db.from("classes").select("id,name,active").eq("id", classId).maybeSingle());
if (existing && (existing.name !== "GAMI STAGING — 15 HS giả lập" || !existing.active)) throw new Error("staging_seed_blocked:class_identity_conflict");
if (!existing) check(await db.from("classes").insert({ id: classId, name: "GAMI STAGING — 15 HS giả lập" }));
check(await db.from("teacher_class_assignments").upsert({ teacher_id: ids[1], class_id: classId }, { ignoreDuplicates: true }));
for (let i = 1; i <= 15; i++) {
  const id = `32000000-0000-0000-0000-${String(i).padStart(12, "0")}`, code = `STG-${String(i).padStart(3, "0")}`;
  const pupil = check(await db.from("students").select("id,student_code,class_id,active").eq("id", id).maybeSingle());
  if (pupil && (pupil.student_code !== code || pupil.class_id !== classId || !pupil.active)) throw new Error("staging_seed_blocked:student_identity_conflict");
  if (!pupil) check(await db.from("students").insert({ id, student_code: code, full_name: `Học sinh giả lập ${i}`, class_id: classId }));
  const owners = check(await db.from("cskh_student_assignments").select("cskh_id").eq("student_id", id));
  if (owners.some((a) => a.cskh_id !== ids[2])) throw new Error("staging_seed_blocked:owner_assignment_conflict");
  check(await db.from("cskh_student_assignments").upsert({ cskh_id: ids[2], student_id: id }, { ignoreDuplicates: true }));
}
console.info("Staging seed PASS: 1 admin, 1 teacher, 1 CSKH, 1 class, 15 synthetic students. Existing passwords/history preserved; no real pupil data.");
