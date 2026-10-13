import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  GAMI_SEED_PASSWORD: password,
} = process.env;
if (!url || !key || !password || password.length < 16)
  throw new Error(
    "Set URL, server-only service role key and a seed password of at least 16 characters.",
  );
if (process.env.GAMI_ALLOW_DEMO_SEED !== "yes")
  throw new Error(
    "Set GAMI_ALLOW_DEMO_SEED=yes for a dedicated test project only.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function check(result) {
  if (result.error)
    throw new Error(`Seed operation failed: ${result.error.code ?? "unknown"}`);
  return result.data;
}
if (process.argv.includes("--if-empty")) {
  const existing = await client
    .from("profiles")
    .select("id", { count: "exact", head: true });
  check(existing);
  if (existing.count && existing.count > 0) {
    console.info(
      "Existing local profiles preserved; run npm run seed explicitly to refresh demo fixtures.",
    );
    process.exit(0);
  }
}
const definitions = [
  ["admin", "Quản trị demo"],
  ["teacher", "Giáo viên 1"],
  ["teacher", "Giáo viên 2"],
  ["cskh", "CSKH 1"],
  ["cskh", "CSKH 2"],
  ["media", "Truyền thông demo"],
];
const accounts = [];
for (let i = 0; i < definitions.length; i++) {
  const [role, full_name] = definitions[i];
  const email = `${role}${i + 1}@gami.example`;
  // Query all Auth pages so repeated runs do not silently create duplicates.
  let existing = null;
  for (let page = 1; ; page++) {
    const data = check(
      await client.auth.admin.listUsers({ page, perPage: 1000 }),
    );
    existing = data.users.find((u) => u.email === email);
    if (existing || data.users.length < 1000) break;
  }
  const user =
    existing ??
    check(
      await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    ).user;
  if (!user) throw new Error("Missing created user");
  check(
    await client
      .from("profiles")
      .upsert({ id: user.id, full_name, role, active: true }),
  );
  accounts.push(user.id);
}
const classes = [1, 2, 3].map((i) => ({
  id: `20000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  name: `Demo ${["A", "B", "C"][i - 1]}`,
}));
check(await client.from("classes").upsert(classes));
const students = Array.from({ length: 15 }, (_, i) => ({
  id: `30000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  student_code: `DEMO-${String(i + 1).padStart(3, "0")}`,
  full_name: `Học sinh demo ${i + 1}`,
  class_id: classes[Math.floor(i / 5)].id,
  media_permission: "pending",
}));
check(await client.from("students").upsert(students));
check(
  await client.from("student_contacts").upsert(
    students.map((s) => ({
      student_id: s.id,
      parent_name: "Phụ huynh giả lập",
      parent_phone: "0000000000",
    })),
  ),
);
check(
  await client.from("teacher_class_assignments").upsert(
    classes.map((c, i) => ({
      class_id: c.id,
      teacher_id: accounts[i === 0 ? 1 : 2],
    })),
  ),
);
check(
  await client.from("cskh_student_assignments").upsert(
    students.map((s, i) => ({
      student_id: s.id,
      cskh_id: accounts[i < 8 ? 3 : 4],
    })),
  ),
);
console.info(
  "Seed complete: 6 accounts, 3 classes, 15 synthetic students. Existing account passwords are unchanged.",
);
